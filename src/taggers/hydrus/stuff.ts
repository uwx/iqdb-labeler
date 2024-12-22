import * as https from 'node:https';
import { promisify } from 'node:util';
import * as zlib from 'node:zlib';

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const response = await fetch('https://ptr.hydrus.network:45871/update?update_hash=3b1f011fa12a58b189a908fd5cd5f2ee4671ee064b4e91416948fba3f06a3ff5', {
    method: 'GET',
    headers: {
        'Hydrus-Key': '4a285629721ca442541ef2c15ea17d1f7f7578b0c3f4f5f2a05f8f0ab297786f'
    },
    agent: httpsAgent,
});

const unzip = promisify(zlib.unzip);

console.log(((await unzip(await response.arrayBuffer())).toString('utf-8')));

// https://ptr.hydrus.network:45871/metadata?since=0
// https://ptr.hydrus.network:45871/update?update_hash=???
// https://ptr.hydrus.network:45871/options

