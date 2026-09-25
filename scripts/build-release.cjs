/* Dependency-free, deterministic end-user ZIP. The explicit public allowlist is the boundary. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..');
const runtimeFiles=['background.js','capture.js','core.js','dashboard.js','date-range.js','date-range.css','workspace-motion.js','workspace-motion.css','demo.js','experiment-coordinator.js','experiments-ui.js','experiments.css','research-workbench.css','experiments.js','index.html','intelligence-ui.js','intelligence.js','manifest.json','presentation.js','runner.js','setup.js','source-layouts.js','storage.js','vault.css'];
const installerFiles=['Setup.cmd','Update.cmd','setup.sh','update.sh','START-HERE.html'];
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let n=0;n<8;n++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(data){let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function zip(entries){
 const local=[],central=[];let offset=0;
 for(const [name,data] of [...entries].sort(([a],[b])=>a.localeCompare(b,'en'))){
  const filename=Buffer.from('BacktestVault/'+name),compressed=zlib.deflateRawSync(data,{level:9}),crc=crc32(data);
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE(8,8);h.writeUInt16LE(33,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(compressed.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(filename.length,26);
  local.push(h,filename,compressed);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(0x314,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(8,10);c.writeUInt16LE(33,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(((name.endsWith('.sh')?0o100755:0o100644)*65536)>>>0,38);c.writeUInt32LE(offset,42);central.push(c,filename);offset+=h.length+filename.length+compressed.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.size,8);end.writeUInt16LE(entries.size,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,directory,end]);
}
function build(output){
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'))),manifest=JSON.parse(fs.readFileSync(path.join(root,'dist/manifest.json')));
 if(pkg.version!==manifest.version||!/^\d+\.\d+\.\d+$/.test(pkg.version))throw Error('Release version mismatch');
 const entries=new Map();
 function add(source,name,normalize){const p=path.join(root,source);if(fs.lstatSync(p).isSymbolicLink())throw Error('Release symlink refused: '+source);let data=fs.readFileSync(p);if(normalize)data=Buffer.from(data.toString('utf8').replace(/\r\n/g,'\n').replace(/\n/g,normalize));entries.set(name,data);}
 for(const name of runtimeFiles)add('dist/'+name,'extension/'+name,'\n');
 for(const name of installerFiles)add('installer/'+name,name,name.endsWith('.cmd')?'\r\n':'\n');
 add('LICENSE','LICENSE','\n');
 entries.set('extension-files.txt',Buffer.from(runtimeFiles.join('\n')+'\n'));
 entries.set('extension-sha256.txt',Buffer.from(runtimeFiles.map(name=>sha(entries.get('extension/'+name))+'  extension/'+name).join('\n')+'\n'));
 entries.set('VERSION.txt',Buffer.from(pkg.version+'\n'));
 entries.set('SHA256SUMS',Buffer.from([...entries].sort(([a],[b])=>a.localeCompare(b,'en')).map(([name,data])=>sha(data)+'  '+name).join('\n')+'\n'));
 fs.mkdirSync(output,{recursive:true});
 const name='backtest-vault-'+pkg.version+'.zip',archive=zip(entries),destination=path.join(output,name);
 fs.writeFileSync(destination,archive,{flag:'wx'});
 fs.writeFileSync(path.join(output,'SHA256SUMS'),sha(archive)+'  '+name+'\n',{flag:'wx'});
 console.log('Built '+destination+' ('+archive.length+' bytes; '+entries.size+' files).');return {destination,entries,version:pkg.version};
}
if(require.main===module){const index=process.argv.indexOf('--output');build(index<0?path.join(root,'releases','backtest-vault-'+require('../package.json').version+'-download'):path.resolve(process.argv[index+1]));}
module.exports={build,runtimeFiles,installerFiles,sha};
