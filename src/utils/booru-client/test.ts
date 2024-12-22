import * as readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import util from 'util';
import client from './index';

const rl = readline.createInterface({ input, output });
const question = util.promisify(rl.question).bind(rl);

clear();

rl.on('line', async (line) => {
	switch (line) {
		case 'clear': case 'cls': {
			clear();
			break;
		}
		case 'exit': {
			rl.write(null, { ctrl: true, name: 'c' });
			break;
		}
		case 'basehandler': case 'baseHandler': {
			const url = `${await question('\x1b[36mURL (string): \x1b[0m')}`;
			const ua = `${await question('\x1b[36muserAgent (optional string): \x1b[0m')}`;
			const xml = `${await question('\x1b[36mXML (optional boolean): \x1b[0m')}`.toLowerCase() === 'true';
			new client.baseHandler().get(url, { userAgent: ua, XML: xml }).then(d => { console.log(d), prompt(); });
			break;
		}
		case 'danbooru': case 'Danbooru': {
			// const tags = JSON.parse(`${await question('\x1b[36mtags (optional array): \x1b[0m')}`);
			// const limit = parseInt(`${await question('\x1b[36mlimit (optional number): \x1b[0m')}`);
			// const fp = `${await question('\x1b[36mfullpost (optional boolean): \x1b[0m')}`.toLowerCase() === 'true';
			// { tags: tags, limit: limit, fullpost: fp }
			new client.danbooru().getPost(1).then(d => { console.log(d), prompt(); });
			break;
		}
		// case 'e621': case 'E621': {
		// 	const tags = JSON.parse(`${await question('\x1b[36mtags (array set to [] if you want no tags): \x1b[0m')}`);
		// 	const limit = parseInt(`${await question('\x1b[36mlimit (optional number): \x1b[0m')}`);
		// 	const ua = `${await question('\x1b[36muserAgent (optional string): \x1b[0m')}`;
		// 	const fp = `${await question('\x1b[36mfullpost (optional boolean): \x1b[0m')}`.toLowerCase() === 'true';
		// 	new client.danbooru({ tags: tags, limit: limit, fullpost: fp }).post.then(d => { console.log(d), prompt(); });
		// 	break;
		// }
		default: {
			console.log(`\x1b[31mfunction \x1b[38;5;9m${line} \x1b[31mdoes not exist...\x1b[0m`);
			prompt();
			break;
		}
	}
});

rl.on('SIGINT', () => {
	rl.question('\x1b[31mAre you sure you want to exit? (Y/N) \x1b[0m', (input) => {
		if (input.match(/^y(es)?$/i)) { 
			rl.pause(); 
		} else {
			prompt();
		}
	});
});

function clear() {
	console.clear();
	prompt();
}

function prompt() {
	rl.setPrompt(`\x1b[36mWhat function would you like to test: \x1b[0m`);
	rl.prompt();
}
// //basehandler accepts any json or xml file
// //must be a json file if options.XML is false or unspecified
// new client.baseHandler().get('https://jsonplaceholder.typicode.com/posts').then(data => console.log(data));
// //must be an xml file is options.XML is true
// new client.baseHandler().get('https://www.w3schools.com/xml/note.xml', { XML: true }).then(data => console.log(data));

// //https://danbooru.donmai.us
// new client.danbooru().post.then(post => console.log(post));

// //https://e621.net
// new client.e621({ userAgent: 'culture-client 0.0.1_beta01 NPM Test Command' }).post.then(post => console.log(post));

// //https://konachan.com
// new client.konachan().post.then(post => console.log(post));

// //https://rule34.xxx
// new client.rule34().post.then(post => console.log(post));

// //https://yande.re
// new client.yandere().post.then(post => console.log(post));
