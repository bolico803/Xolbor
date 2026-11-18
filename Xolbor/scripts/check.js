'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
let failed=false,count=0;
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','runtime','.git'].includes(entry.name))continue;const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(file.endsWith('.js')){count++;const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0){failed=true;console.error(result.stderr);}}}}
walk(root);console.log(`${count} JavaScript files checked.`);process.exitCode=failed?1:0;
