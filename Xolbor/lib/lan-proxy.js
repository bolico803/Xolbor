'use strict';
const net=require('node:net');const os=require('node:os');
const address=process.env.XOLBOR_LAN_ADDRESS,port=Number(process.env.PORT||5897);
const valid=Object.values(os.networkInterfaces()).flat().some(i=>i&&i.family==='IPv4'&&!i.internal&&i.address===address);
if(!valid)throw new Error('Adresse réseau locale introuvable');
net.createServer(client=>{const upstream=net.connect(port,'127.0.0.1');client.pipe(upstream);upstream.pipe(client);client.on('error',()=>upstream.destroy());upstream.on('error',()=>client.destroy())}).listen(port,address,()=>console.log(`Xolbor réseau local : http://${address}:${port}`));
