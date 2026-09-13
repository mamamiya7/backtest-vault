const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{
  let name;try{name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400).end();return;}
  const target=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!target.startsWith(root+path.sep)||!types[path.extname(target)]||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404).end('Not found');return;}
  res.writeHead(200,{'Content-Type':types[path.extname(target)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; connect-src 'none'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
  fs.createReadStream(target).pipe(res);
});
server.listen(8767,'127.0.0.1',()=>console.log('Backtest Vault: http://127.0.0.1:8767/?demo=1'));
