import { BSKY_IDENTIFIER, BSKY_PASSWORD, PDS } from '../config';
import { plcRequestToken, plcSetupLabeler } from './util/plc';
import * as readline from 'readline/promises';

await plcRequestToken({
    identifier: BSKY_IDENTIFIER,
    password: BSKY_PASSWORD,
    pds: PDS
});

// wait for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const answer = await rl.question('Input PLC token: ');
rl.close();

console.log(`Received PLC token: ${answer}`);

console.log(await plcSetupLabeler({
    identifier: BSKY_IDENTIFIER,
    password: BSKY_PASSWORD,
    pds: PDS,
    plcToken: answer.trim(),
    endpoint: 'https://labeler.nothingeverhappen.com'
}));
