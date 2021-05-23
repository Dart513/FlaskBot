const dotenv = require('dotenv');
dotenv.config();

const Discord = require('discord.js');
const client = new Discord.Client();
const fdm = new (require('./flatDataManager'));

const readline = require('readline');


const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


//Log everything
client.once('ready', () => {
    console.log("Ready!");
    client.user.setActivity(`for the moment you slip up`, { type: 'WATCHING' })
    .catch(console.error);

    //Set up the guild in storage
    let values = client.guilds.cache.values()
    
    for (const element of values) {
        console.log("Processing guild", element.name);
        fdm.addGuild(element.id, element.name);
    }

    fdm.save();

});



client.on('guildCreate', (guild) => {
    //Set up the guild in storage
    fdm.addGuild(guild.id, guild.name);
});


//TODO: Process commands to slash commands when everything is done.

client.on('message', processMsg);

//Code for main substr replacement operation
async function processMsg(message) {
    let content = message.cleanContent;
    //if (message.channel.name == 'general') console.log("Message");
    if (!message.author.bot) {

        let replacements = fdm.getReplacementsForGuild(message.guild.id);

        
        //Make sure to only match fragments first
        let priorityReplacements = replacements.filter(element => !element.options.replacePartial);
        
        let success = (await Promise.all(priorityReplacements.map(async (element) => {
            if (content.search(element.regex) > -1) {
                message.channel.send(element.result);
                return true;
            }
            else return false;
        }))).filter(element => element === true).length > 0;


        //Now check for any replacement matches which match fragments
        if (!success) {
            priorityReplacements = replacements.filter(element => element.options.replacePartial); //Now check for fragment replacement matches
            
            content = ` ${content} `;
            oldContent = content;

            await Promise.all(priorityReplacements.map(async (element) => {

                if (content.search(element.regex) > -1) {
                    content = content.replace(element.regex, element.result);
                }
            }));

            if (content !== oldContent) message.channel.send(content);
        }
    }
}


rl.on('line', (input) => {

    if (input === "reload") {
        fdm.reload();
    }

});



client.login(process.env.TOKEN);

process.on("SIGINT", () => {
    console.log("Shutting down");
    fdm.close();
    rl.close();

    client.destroy();
});

