/* Store upload ZIP: manifest at root; no installers, private keys, research or licenses. */
const fs=require('node:fs'),path=require('node:path');
const {runtimeFiles,zip,sha}=require('./build-release.cjs');
const root=path.resolve(__dirname,'..');
function build(output){const entries=new Map();for(const file of runtimeFiles){const p=path.join(root,'dist',file);if(fs.lstatSync(p).isSymbolicLink())throw Error('Symlink refused: '+file);const data=fs.readFileSync(p);if(/"d"\s*:|PRIVATE KEY/.test(file==='license-keys.js'?data.toString():''))throw Error('Private issuer key in release.');entries.set(file,data);}entries.set('LICENSE',fs.readFileSync(path.join(root,'LICENSE')));const v=require('../package.json').version,name='backtest-vault-'+v+'-store.zip';fs.mkdirSync(output,{recursive:true});const archive=zip(entries,'');fs.writeFileSync(path.join(output,name),archive,{flag:'wx'});fs.writeFileSync(path.join(output,'SHA256SUMS-store'),sha(archive)+'  '+name+'\n',{flag:'wx'});console.log('Built Store upload candidate: '+name);return {entries,destination:path.join(output,name)};}
if(require.main===module){const i=process.argv.indexOf('--output');build(i<0?path.join(root,'releases','store-'+require('../package.json').version):path.resolve(process.argv[i+1]));}
module.exports={build};
