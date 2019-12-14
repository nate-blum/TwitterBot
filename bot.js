const twitter = require('twitter');
const disc = require('discord.js');
const auth = require('./auth.json');
const random = require('random');
const he = require('he');
const axios = require('axios');
const groups = require('./groups.json');

var client = new disc.Client();
var t;

client.on('ready', async () => {
	client.user.setActivity('for t@help', {type: 'WATCHING'});
	t = new twitter({
		consumer_key: auth.twitter['api-key'],
		consumer_secret: auth.twitter['api-secret-key'],
		bearer_token: (
			await axios({
				url: 'https://api.twitter.com/oauth2/token?grant_type=client_credentials',
				method: 'post',
				auth: {
					username: auth.twitter['api-key'],
					password: auth.twitter['api-secret-key']
				}
			})
		).data.access_token
	});
});

client.on('error', console.error);
client.on('warn', console.warn);
client.on('debug', console.info);

client.on('message', message => {
	if (message.author.bot || !/t@/g.test(message.content)) return;

	let args = message.content.split(' ');
	if (typeof functions[args[0].replace('t@', '')] == 'function') functions[args[0].replace('t@', '')](message);
});

client.login(auth.discord.token);

var functions = {
	help: args => {
		args.channel.send(
			'The three available functions are: t@user, t@hashtag, and t@twitter. In order to use any of them, send the appropriate command along with the thing you wish to search for. \nFor instance: t@user realchegg'
		);
	},
	user: async args => {
		for (let i = 0; i < (args.content.split(' ')[2] || 1); i++) {
			t.get(
				'statuses/user_timeline',
				{
					screen_name: args.content.split(' ')[1],
					include_rts: true,
					count: 200,
					exclude_replies: true,
					tweet_mode: 'extended'
				},
				(error, tweets, res) => {
					if (!error) {
						if (args.channel.nsfw) {
							let sensitive_tweets = tweets.filter(
								t =>
									t.possibly_sensitive ||
									(t.retweeted_status && t.retweeted_status.possibly_sensitive)
							);
							if (sensitive_tweets.length > 0)
								send_tweet(sensitive_tweets[random.int(0, sensitive_tweets.length - 1)], args);
						} else send_tweet(tweets[random.int(0, tweets.length - 1)], args);
					}
				}
			);
		}
	},
	hashtag: async args => {
		for (let i = 0; i < (args.content.split(' ')[2] || 1); i++) {
			t.get(
				'search/tweets',
				{
					q: `%23${args.content.split(' ')[1]}`,
					result_type: 'popular',
					count: 50,
					tweet_mode: 'extended'
				},
				(error, tweets, res) =>
					!error && send_tweet(tweets.statuses[random.int(0, tweets.statuses.length - 1)], args)
			);
		}
	},
	twitter: async args => {
		for (let i = 0; i < (args.content.split(' ')[2] || 3); i++) {
			functions.user({
				channel: args.channel,
				content: `t@user ${
					groups[args.content.split(' ')[1]][random.int(0, groups[args.content.split(' ')[1]].length - 1)]
				}`
			});
		}
	}
};

function send_tweet(tweet, args) {
	let embed = {};
	if (tweet.retweeted_status) {
		if (tweet.retweeted_status.possibly_sensitive && !args.channel.nsfw) {
			console.log(`https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`);
			return args.channel.send('You must be in an NSFW channel to see this post.');
		}
	}
	if (tweet.possibly_sensitive && !args.channel.nsfw) {
		console.log(`https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`);
		return args.channel.send('You must be in an NSFW channel to see this post.');
	}
	if (typeof tweet.retweeted_status != 'undefined') {
		Object.assign(embed, {
			author: {
				name: `${tweet.user.screen_name} retweeted: ${tweet.retweeted_status.user.name} (@${tweet.retweeted_status.user.screen_name})`,
				url: `https://twitter.com/${tweet.retweeted_status.user.screen_name}/status/${tweet.retweeted_status.id_str}`,
				icon_url: tweet.retweeted_status.user.profile_image_url_https
			},
			color: 44269,
			description: he.decode(tweet.retweeted_status.full_text),
			footer: {
				icon_url:
					'https://images-ext-1.discordapp.net/external/bXJWV2Y_F3XSra_kEqIYXAAsI3m1meckfLhYuWzxIfI/https/abs.twimg.com/icons/apple-touch-icon-192x192.png',
				text: 'Twitter'
			}
		});

		if (
			typeof tweet.retweeted_status.extended_entities != 'undefined' &&
			typeof tweet.retweeted_status.extended_entities.media != 'undefined' &&
			tweet.retweeted_status.extended_entities.media[0].type == 'photo'
		) {
			embed.image = {
				url: tweet.retweeted_status.extended_entities.media[0].media_url
			};
		}
	} else {
		Object.assign(embed, {
			author: {
				name: `${tweet.user.name} (@${tweet.user.screen_name})`,
				url: `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`,
				icon_url: tweet.user.profile_image_url_https
			},
			color: 44269,
			description: he.decode(tweet.full_text),
			footer: {
				icon_url:
					'https://images-ext-1.discordapp.net/external/bXJWV2Y_F3XSra_kEqIYXAAsI3m1meckfLhYuWzxIfI/https/abs.twimg.com/icons/apple-touch-icon-192x192.png',
				text: 'Twitter'
			}
		});

		if (
			typeof tweet.extended_entities != 'undefined' &&
			typeof tweet.extended_entities.media != 'undefined' &&
			tweet.extended_entities.media[0].type == 'photo'
		) {
			embed.image = {
				url: tweet.extended_entities.media[0].media_url
			};
		}
	}
	args.channel.send({embed});

	if (
		typeof tweet.retweeted_status != 'undefined' &&
		typeof tweet.retweeted_status.extended_entities != 'undefined' &&
		tweet.retweeted_status.extended_entities.media[0].type != 'photo'
	) {
		args.channel.send(
			tweet.retweeted_status.extended_entities.media[0].video_info.variants
				.find(
					o =>
						o.bitrate ==
						Math.max(
							...tweet.retweeted_status.extended_entities.media[0].video_info.variants
								.filter(o => o['content_type'] == 'video/mp4')
								.map(o => o.bitrate)
						)
				)
				.url.replace(/\?.+/g, '')
		);
	} else if (
		typeof tweet.extended_entities != 'undefined' &&
		typeof tweet.extended_entities.media != 'undefined' &&
		tweet.extended_entities.media[0].type != 'photo'
	) {
		args.channel.send(
			tweet.extended_entities.media[0].video_info.variants
				.find(
					o =>
						o.bitrate ==
						Math.max(
							...tweet.extended_entities.media[0].video_info.variants
								.filter(o => o['content_type'] == 'video/mp4')
								.map(o => o.bitrate)
						)
				)
				.url.replace(/\?.+/g, '')
		);
	}
}
