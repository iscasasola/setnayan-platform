import Foundation
import Capacitor
import StoreKit

/**
 * Apple In-App Purchase for the phone app — StoreKit 2, our own small plugin
 * (owner 2026-10-18, DECISION_LOG "IN-APP PURCHASE — THE FIVE DECISIONS"; the
 * 2026-10-08 row's "StoreKit direct through our own small plugin" — no
 * RevenueCat account, no fee, nothing third-party in the money path).
 *
 * The web (apps/web/lib/iap/native-store.ts) calls:
 *
 *   getProducts({ productIds })  → { products: [{ id, displayName, displayPrice, currencyCode, storefront }] }
 *       Apple's own name and price STRING for each product (`displayPrice`,
 *       already in the person's currency). The web never shows any other price.
 *       `currencyCode` (the price's ISO 4217 code) and `storefront` (StoreKit's
 *       current storefront, ISO 3166-1 alpha-3) let the web withhold a price
 *       whose currency is not the one that storefront charges (build 6,
 *       2026-10-25: the sheet said "$1.99" where Apple charged "₱ 95.00").
 *
 *   purchase({ productId, appAccountToken })
 *       → { result: "purchased", jws, transactionId }   Apple charged; the web
 *              sends `jws` to our server, which verifies it and switches the
 *              item on — then calls finish().
 *       → { result: "pending" }    Ask to Buy / SCA: Apple will tell us later
 *              (Transaction.updates → the "transaction" event below).
 *       → { result: "cancelled" }  the person closed Apple's sheet.
 *       → { result: "failed" }     anything else. Apple's error text is NOT
 *              forwarded: the web says one true sentence ("nothing charged").
 *       `appAccountToken` is the UUID our server minted for this purchase; Apple
 *       signs it into the transaction, which is how the server knows the event.
 *
 *   finish({ transactionId })  → finishes a transaction the SERVER confirmed.
 *       Never called before the server said "on": an unfinished transaction is
 *       re-delivered by Apple at every launch, which is the safety net.
 *
 *   pendingTransactions()  → { transactions: [{ jws, transactionId }] }
 *       every transaction Apple completed that we have not finished (the app was
 *       closed mid-purchase, Ask to Buy approved later). The web hands each to
 *       the server on launch.
 *
 *   restore()  → { transactions: [jws, …] }  Profile › Restore purchases.
 *       `AppStore.sync()` (Apple may ask for the Apple ID password), then every
 *       transaction this Apple ID holds for the app. Consumables are included
 *       because Info.plist sets SKIncludeConsumableInAppPurchaseHistory (iOS 18+).
 *
 * Event "transaction" { jws, transactionId } — Transaction.updates, retained
 * until a page listens.
 *
 * 🔒 Nothing here logs, stores or forwards a transaction anywhere but the page
 * that asked; verification is the SERVER's job (it trusts only Apple Root CA -
 * G3), so StoreKit's own on-device check is only used to drop a transaction
 * StoreKit itself calls unverified.
 *
 * Registered as an in-app plugin by SetnayanBridgeViewController.capacitorDidLoad.
 */
@objc(SetnayanStorePlugin)
public class SetnayanStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SetnayanStorePlugin"
    public let jsName = "SetnayanStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pendingTransactions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise)
    ]

    /// Only our own products, ever — the same ids as apps/web/lib/iap/products.ts.
    private static let productPrefix = "com.setnayan.app."

    private var updatesTask: Task<Void, Never>?
    private var products: [String: Product] = [:]
    /// Verified transactions the server has not yet confirmed, by id.
    private var unfinished: [UInt64: Transaction] = [:]
    private var purchasing = false

    override public func load() {
        updatesTask = Task.detached { [weak self] in
            for await update in Transaction.updates {
                guard let self else { return }
                guard case .verified(let transaction) = update,
                      transaction.productID.hasPrefix(Self.productPrefix) else { continue }
                await self.remember(transaction)
                self.notifyListeners("transaction", data: [
                    "jws": update.jwsRepresentation,
                    "transactionId": String(transaction.id)
                ], retainUntilConsumed: true)
            }
        }
    }

    deinit {
        updatesTask?.cancel()
    }

    @MainActor private func remember(_ transaction: Transaction) {
        unfinished[transaction.id] = transaction
    }

    // MARK: - Products

    @objc func getProducts(_ call: CAPPluginCall) {
        let ids = (call.getArray("productIds") as? [String] ?? []).filter { $0.hasPrefix(Self.productPrefix) }
        guard !ids.isEmpty else {
            call.reject("No product ids.", "INVALID")
            return
        }
        Task { @MainActor in
            do {
                let found = try await Product.products(for: ids)
                let storefront = await Storefront.current?.countryCode ?? ""
                var out: [[String: Any]] = []
                for product in found {
                    self.products[product.id] = product
                    out.append([
                        "id": product.id,
                        "displayName": product.displayName,
                        "displayPrice": product.displayPrice,
                        "currencyCode": product.priceFormatStyle.currencyCode,
                        "storefront": storefront
                    ])
                }
                call.resolve(["products": out])
            } catch {
                call.reject("The App Store did not answer.", "UNAVAILABLE")
            }
        }
    }

    // MARK: - Purchase

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId"), productId.hasPrefix(Self.productPrefix),
              let tokenString = call.getString("appAccountToken"), let token = UUID(uuidString: tokenString) else {
            call.reject("A product and a purchase token are required.", "INVALID")
            return
        }
        Task { @MainActor in
            guard !self.purchasing else {
                call.reject("A purchase is already open.", "BUSY")
                return
            }
            self.purchasing = true
            defer { self.purchasing = false }
            do {
                let product: Product
                if let cached = self.products[productId] {
                    product = cached
                } else if let fetched = try await Product.products(for: [productId]).first {
                    product = fetched
                } else {
                    call.resolve(["result": "failed"])
                    return
                }
                let result = try await product.purchase(options: [.appAccountToken(token)])
                switch result {
                case .success(let verification):
                    guard case .verified(let transaction) = verification else {
                        call.resolve(["result": "failed"])
                        return
                    }
                    self.unfinished[transaction.id] = transaction
                    call.resolve([
                        "result": "purchased",
                        "jws": verification.jwsRepresentation,
                        "transactionId": String(transaction.id)
                    ])
                case .pending:
                    call.resolve(["result": "pending"])
                case .userCancelled:
                    call.resolve(["result": "cancelled"])
                @unknown default:
                    call.resolve(["result": "failed"])
                }
            } catch {
                call.resolve(["result": "failed"])
            }
        }
    }

    // MARK: - Finish (only after the server confirmed)

    @objc func finish(_ call: CAPPluginCall) {
        guard let raw = call.getString("transactionId"), let id = UInt64(raw) else {
            call.reject("A transaction id is required.", "INVALID")
            return
        }
        Task { @MainActor in
            if let transaction = self.unfinished.removeValue(forKey: id) {
                await transaction.finish()
                call.resolve(["finished": true])
                return
            }
            for await result in Transaction.unfinished {
                if case .verified(let transaction) = result, transaction.id == id {
                    await transaction.finish()
                    call.resolve(["finished": true])
                    return
                }
            }
            call.resolve(["finished": false])
        }
    }

    // MARK: - Unfinished (delivered on launch)

    @objc func pendingTransactions(_ call: CAPPluginCall) {
        Task { @MainActor in
            var out: [[String: Any]] = []
            for await result in Transaction.unfinished {
                guard case .verified(let transaction) = result,
                      transaction.productID.hasPrefix(Self.productPrefix) else { continue }
                self.unfinished[transaction.id] = transaction
                out.append(["jws": result.jwsRepresentation, "transactionId": String(transaction.id)])
            }
            call.resolve(["transactions": out])
        }
    }

    // MARK: - Restore

    @objc func restore(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                try await AppStore.sync()
            } catch {
                // A cancelled Apple ID prompt is not an error worth a sentence;
                // what the phone already holds is still returned below.
            }
            var out: [String] = []
            for await result in Transaction.all {
                guard case .verified(let transaction) = result,
                      transaction.productID.hasPrefix(Self.productPrefix) else { continue }
                out.append(result.jwsRepresentation)
            }
            for await result in Transaction.unfinished {
                guard case .verified(let transaction) = result,
                      transaction.productID.hasPrefix(Self.productPrefix) else { continue }
                self.unfinished[transaction.id] = transaction
                out.append(result.jwsRepresentation)
            }
            call.resolve(["transactions": out])
        }
    }
}
