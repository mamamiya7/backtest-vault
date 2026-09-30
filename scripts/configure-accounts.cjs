/* Operator-only build step. No provider secrets are written to the extension. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
function configure(value,root=path.resolve(__dirname,'..')){
 const url=new URL(value);if(url.protocol!=='https:'||url.pathname!=='/'||url.hash||url.search||url.username||url.password)throw Error('Use the HTTPS origin of your deployed account API.');
 fs.writeFileSync(path.join(root,'dist/commercial-config.js'),"/* Public deployment URL only. */\n(function(root){'use strict';root.VaultCommercialConfig=Object.freeze("+JSON.stringify({mode:'account',apiOrigin:url.origin})+");})(globalThis);\n");
 const filename=path.join(root,'dist/manifest.json'),m=JSON.parse(fs.readFileSync(filename));m.host_permissions=[url.origin+'/*'];m.content_security_policy.extension_pages="script-src 'self'; object-src 'none'; connect-src "+url.origin+"; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'";fs.writeFileSync(filename,JSON.stringify(m,null,2)+'\n');return url.origin;
}
if(require.main===module){const i=process.argv.indexOf('--origin');if(i<0||!process.argv[i+1])throw Error('Usage: node scripts/configure-accounts.cjs --origin https://YOUR_ACCOUNT_API');console.log('Configured account origin: '+configure(process.argv[i+1]));}
module.exports={configure};
