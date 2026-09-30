'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),zlib=require('node:zlib');
const {build}=require('../scripts/build-release.cjs'),{build:store}=require('../scripts/build-store.cjs'),manifest=require('../dist/manifest.json');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'vault-store-assets-'));
try{
 const release=build(path.join(temp,'release')),upload=store(path.join(temp,'store'));
 for(const [size,filename]of Object.entries(manifest.icons)){const original=fs.readFileSync(path.join(root,'dist',filename));assert.equal(original.readUInt32BE(16),Number(size));assert.equal(original.readUInt32BE(20),Number(size));assert.deepEqual(release.entries.get('extension/'+filename),original);assert.deepEqual(upload.entries.get(filename),original);}
 // Inspect the actual ZIP payload, not only the source Map: binary PNG must not be newline-normalized.
 for(const packageFile of [release.destination,upload.destination]){const zip=fs.readFileSync(packageFile);let offset=0,count=0;while(zip.readUInt32LE(offset)===0x04034b50){const compressed=zip.readUInt32LE(offset+18),nameLength=zip.readUInt16LE(offset+26),extra=zip.readUInt16LE(offset+28),name=zip.subarray(offset+30,offset+30+nameLength).toString(),start=offset+30+nameLength+extra;if(/icon\d+\.png$/.test(name)){assert.deepEqual(zlib.inflateRawSync(zip.subarray(start,start+compressed)),fs.readFileSync(path.join(root,'dist',path.basename(name))));count++;}offset=start+compressed;}assert.equal(count,4);}
 console.log('PASS: four valid icon sizes and byte-exact PNGs in Store and Windows/Linux ZIPs.');
}finally{const resolved=path.resolve(temp),base=path.resolve(os.tmpdir());if(path.dirname(resolved)!==base||!path.basename(resolved).startsWith('vault-store-assets-'))throw Error('Refusing unexpected cleanup path.');fs.rmSync(resolved,{recursive:true,force:true});}
