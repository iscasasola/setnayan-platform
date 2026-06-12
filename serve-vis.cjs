const http=require('http'),fs=require('fs');
http.createServer((q,r)=>{fs.readFile('/tmp/sn-cipher/visual.html',(e,d)=>{if(e){r.writeHead(500);r.end('err');return;}r.writeHead(200,{'Content-Type':'text/html'});r.end(d);});}).listen(4198,()=>console.log('4198'));
