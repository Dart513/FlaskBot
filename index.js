const dotenv = require('dotenv');
const Path = require('path');
dotenv.config({path: Path.join(__dirname, '.env')});

const Discord = require('discord.js');

const Intents = Discord.Intents;

const intents = new Intents([
    Intents.NON_PRIVILEGED, // include all non-privileged intents, would be better to specify which ones you actually need
    "GUILD_MEMBERS", // lets you request guild members 
]);

const client = new Discord.Client({ ws: { intents }, partials: ['USER', 'REACTION', 'MESSAGE']  });
const fdm = new (require('./flatDataManager'));

const verify = new (require('./verify'));

const readline = require('readline');

const commandProcessor = new (require('./commandProcessor'))({
    Discord: Discord,
    fdm: fdm,
    verify: verify,
    client: client
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


//Startup everything when the bot-server connection has been made
client.once('ready', () => {
    console.log("Ready!");
    client.user.setActivity(`over tronlings`, { type: 'WATCHING' })
    .catch(console.error);

    //Set up the guild in storage
    let values = client.guilds.cache.values()
    
    for (const element of values) {
        console.log("Processing guild", element.name);
        fdm.addGuild(element.id, element.name);
    }

    fdm.saveConfig();

});


//When the bot is invited into a new guild, we make sure we set up everything properly. 
client.on('guildCreate', (guild) => {
    //Set up the guild in storage
    fdm.addGuild(guild.id, guild.name);
});


//TODO: Process commands to slash commands when everything is done.
client.on('message', commandProcessor.processMsg.bind(commandProcessor));

client.on("messageReactionAdd", function(messageReaction, user){
    //console.log(messageReaction.emoji);
});


rl.on('line', (input) => {

    if (input === "reload") {
        console.log("Reloading!");
        fdm.reload();
    }

});



client.login(process.env.TOKEN);

process.on("SIGINT", () => {
    console.log("Shutting down");
    fdm.close();
    rl.close();
    verify.close();

    client.destroy();
});

