/* Copies only reviewed source and fictional screenshots. Never scans archives. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),version=require('../package.json').version;
const files=[
 'README.md','CONTRIBUTING.md','PRIVACY.md','SECURITY.md','CHANGELOG.md','LICENSE','.gitignore','package.json','package-lock.json',
 'dist/index.html','dist/vault.css','dist/dashboard.js','dist/core.js','dist/storage.js','dist/presentation.js','dist/demo.js','dist/intelligence.js','dist/intelligence-ui.js','dist/capture.js','dist/background.js','dist/manifest.json',
 'dist/experiments.js','dist/experiment-coordinator.js','dist/runner.js','dist/experiments-ui.js','dist/experiments.css',
 'tests/test-experiments.cjs','tests/test-experiments-ui.cjs','tests/test-runner.cjs','docs/EXPERIMENTS.md','docs/images/10-experiments.png',
 'tests/test-vault.cjs','tests/test-dashboard.cjs','tests/test-presentation.cjs','tests/test-demo.cjs','tests/test-intelligence.cjs','tests/test-intelligence-ui.cjs',
 'scripts/serve.cjs','scripts/check.cjs','scripts/package-public.cjs',
 'docs/DEMO.md','docs/INSTALL.md','docs/LIMITATIONS.md','docs/PUBLICATION.md','docs/UI-AUDIT.md','docs/INTELLIGENCE.md',
 'docs/images/01-overview.png','docs/images/02-settings.png','docs/images/03-compare.png','docs/images/04-mobile.png','docs/images/05-warning.png','docs/images/06-empty.png','docs/images/07-guide.png','docs/images/08-leaderboard.png','docs/images/09-leaderboard-mobile.png',
 '.github/workflows/checks.yml','.github/ISSUE_TEMPLATE/bug_report.md','.github/pull_request_template.md'
];
function verify(name){
 const source=path.join(root,name);if(!fs.existsSync(source))throw Error('Missing public file: '+name);
 if(fs.lstatSync(source).isSymbolicLink())throw Error('Symlink not allowed: '+name);
 const data=fs.readFileSync(source);
 if(!name.endsWith('.png')){
  const value=data.toString('utf8');
  const privatePath=/[A-Z]:[\\/]+Users[\\/]|\/Users\/|\/home\/[^/\s]+/;
  const credential=/(?:sk-(?:proj-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
  if(privatePath.test(value)||credential.test(value))throw Error('Potential private content in '+name);
 }
 return {path:name,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};
}
const manifest=files.map(verify);
if(process.argv.includes('--check')){console.log('PASS: '+files.length+' allowlisted public files exist; common private-path and credential scan passed.');process.exit(0);}
const destination=path.resolve(root,'releases','backtest-vault-'+version+'-public');
if(!destination.startsWith(path.join(root,'releases')+path.sep))throw Error('Invalid output directory');
if(fs.existsSync(destination))throw Error('Output already exists; previous package left intact: '+destination);
fs.mkdirSync(destination,{recursive:true});
for(const name of files){const target=path.join(destination,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,name),target);}
fs.writeFileSync(path.join(destination,'PACKAGE-MANIFEST.json'),JSON.stringify({name:'Backtest Vault public source',version,files:manifest},null,2)+'\n');
console.log('Prepared '+files.length+' public files in '+destination);
