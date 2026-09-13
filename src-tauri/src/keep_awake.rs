// S0 measured VideoToolbox input fall 30 -> 16 fps within 3s of window occlusion,
// full suspension after ~8min hidden (S0-FINDING.md § 4.1). `backgroundThrottling:
// "disabled"` in tauri.conf.json stops WebKit from starving the page; this module
// stops the OS from sleeping the MACHINE underneath it. Two commands, held by the
// caller between starting and stopping the encoder — this module owns no lifecycle
// of its own. No third-party crate: both platform calls are two stable OS
// functions, so raw FFI avoids trusting an unreviewed crate for something this load
// bearing.
//
// macOS: IOPMAssertionCreateWithName(kIOPMAssertionTypePreventUserIdleSystemSleep).
// Windows: SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED).
// Both are display+system sleep only — neither disables the screensaver lock a user
// set deliberately, and neither requires an admin prompt.

#[cfg(target_os = "macos")]
mod imp {
    use std::ffi::{c_void, CString};
    use std::os::raw::c_char;
    use std::sync::Mutex;

    type CFStringRef = *const c_void;
    type CFAllocatorRef = *const c_void;
    type CFIndex = isize;
    type IOPMAssertionID = u32;
    type IOPMAssertionLevel = u32;
    type IOReturn = i32;

    const K_IOPM_ASSERTION_LEVEL_ON: IOPMAssertionLevel = 255;
    const K_CF_STRING_ENCODING_UTF8: u32 = 0x0800_0100;

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        static kCFAllocatorDefault: CFAllocatorRef;
        fn CFStringCreateWithCString(
            alloc: CFAllocatorRef,
            c_str: *const c_char,
            encoding: u32,
        ) -> CFStringRef;
        fn CFRelease(cf: CFStringRef);
    }

    #[link(name = "IOKit", kind = "framework")]
    extern "C" {
        fn IOPMAssertionCreateWithName(
            assertion_type: CFStringRef,
            assertion_level: IOPMAssertionLevel,
            assertion_name: CFStringRef,
            assertion_id: *mut IOPMAssertionID,
        ) -> IOReturn;
        fn IOPMAssertionRelease(assertion_id: IOPMAssertionID) -> IOReturn;
    }

    // Silence the unused-CFIndex warning without dropping the type alias, which
    // documents the CF ABI this binds against.
    #[allow(dead_code)]
    const _: Option<CFIndex> = None;

    static ASSERTION: Mutex<Option<IOPMAssertionID>> = Mutex::new(None);

    fn cfstr(s: &str) -> CFStringRef {
        let c = CString::new(s).expect("no interior NUL");
        unsafe { CFStringCreateWithCString(kCFAllocatorDefault, c.as_ptr(), K_CF_STRING_ENCODING_UTF8) }
    }

    pub fn start() -> Result<(), String> {
        let mut guard = ASSERTION.lock().map_err(|e| e.to_string())?;
        if guard.is_some() {
            return Ok(());
        }
        let assertion_type = cfstr("PreventUserIdleSystemSleep");
        let name = cfstr("Setnayan live broadcast in progress");
        let mut id: IOPMAssertionID = 0;
        let ret = unsafe {
            IOPMAssertionCreateWithName(assertion_type, K_IOPM_ASSERTION_LEVEL_ON, name, &mut id)
        };
        unsafe {
            CFRelease(assertion_type);
            CFRelease(name);
        }
        if ret != 0 {
            return Err(format!("IOPMAssertionCreateWithName failed: IOReturn {ret}"));
        }
        *guard = Some(id);
        Ok(())
    }

    pub fn stop() -> Result<(), String> {
        let mut guard = ASSERTION.lock().map_err(|e| e.to_string())?;
        if let Some(id) = guard.take() {
            let ret = unsafe { IOPMAssertionRelease(id) };
            if ret != 0 {
                return Err(format!("IOPMAssertionRelease failed: IOReturn {ret}"));
            }
        }
        Ok(())
    }

    #[cfg_attr(not(test), allow(dead_code))] // observability hook, exercised by the lifecycle test
    pub fn is_held() -> bool {
        ASSERTION.lock().map(|g| g.is_some()).unwrap_or(false)
    }
}

#[cfg(target_os = "windows")]
mod imp {
    use std::sync::atomic::{AtomicBool, Ordering};

    type ExecutionState = u32;
    const ES_CONTINUOUS: ExecutionState = 0x8000_0000;
    const ES_SYSTEM_REQUIRED: ExecutionState = 0x0000_0001;
    const ES_DISPLAY_REQUIRED: ExecutionState = 0x0000_0002;

    #[link(name = "kernel32")]
    extern "system" {
        fn SetThreadExecutionState(flags: ExecutionState) -> ExecutionState;
    }

    static HELD: AtomicBool = AtomicBool::new(false);

    pub fn start() -> Result<(), String> {
        let ret =
            unsafe { SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED) };
        if ret == 0 {
            return Err("SetThreadExecutionState failed (returned NULL)".to_string());
        }
        HELD.store(true, Ordering::SeqCst);
        Ok(())
    }

    pub fn stop() -> Result<(), String> {
        if HELD.swap(false, Ordering::SeqCst) {
            let ret = unsafe { SetThreadExecutionState(ES_CONTINUOUS) };
            if ret == 0 {
                return Err("SetThreadExecutionState failed (returned NULL)".to_string());
            }
        }
        Ok(())
    }

    #[cfg_attr(not(test), allow(dead_code))] // observability hook, exercised by the lifecycle test
    pub fn is_held() -> bool {
        HELD.load(Ordering::SeqCst)
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod imp {
    pub fn start() -> Result<(), String> {
        Ok(())
    }
    pub fn stop() -> Result<(), String> {
        Ok(())
    }
    #[cfg_attr(not(test), allow(dead_code))] // observability hook, exercised by the lifecycle test
    pub fn is_held() -> bool {
        false
    }
}

/// Held between `encoder_start` and `encoder_stop` once S5/S6 land — call this the
/// moment the encode pipeline begins producing frames, never earlier (an assertion
/// held before the ceremony starts just burns battery on a laptop for no reason).
#[tauri::command]
pub fn start_keep_awake() -> Result<(), String> {
    imp::start()
}

/// Idempotent: safe to call even if `start_keep_awake` was never called or already
/// released. Must be called on every encoder-stop path, including error exits — an
/// assertion leaked past the broadcast keeps the couple's laptop awake all night.
#[tauri::command]
pub fn stop_keep_awake() -> Result<(), String> {
    imp::stop()
}

#[cfg(test)]
mod tests {
    // ONE test function, not three: `imp::ASSERTION`/`HELD` is a process-global
    // static, and `cargo test` runs tests in parallel threads by default — split
    // across tests, these cases race on that global and flake. Sequencing them in
    // one function is the whole fix.
    use super::*;

    #[test]
    fn keep_awake_lifecycle() {
        // stop-before-start is a no-op, not an error.
        assert!(stop_keep_awake().is_ok());
        assert!(!imp::is_held());

        // start, then a second start does not leak/replace the first assertion.
        assert!(start_keep_awake().is_ok());
        assert!(imp::is_held());
        assert!(start_keep_awake().is_ok());
        assert!(imp::is_held());

        // stop releases it, and a second stop is a no-op.
        assert!(stop_keep_awake().is_ok());
        assert!(!imp::is_held());
        assert!(stop_keep_awake().is_ok());
        assert!(!imp::is_held());
    }
}
