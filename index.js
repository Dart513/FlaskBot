const dotenv = require('dotenv');
dotenv.config();

const Discord = require('discord.js');
const client = new Discord.Client();
const fdm = new (require('./flatDataManager'));


const verify = new (require('./verify'));

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


//Checks if a string matches an image
const isImage = new RegExp("(png|jpg|jpeg)(?!\.)", "gmi");


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

    fdm.save();

});


//When the bot is invited into a new guild, we make sure we set up everything properly. 
client.on('guildCreate', (guild) => {
    //Set up the guild in storage
    fdm.addGuild(guild.id, guild.name);
});


//TODO: Process commands to slash commands when everything is done.
client.on('message', processMsg);


/**
 * Deal with messages when they come in
 * @param {Message} message 
 */
async function processMsg(message) {
    let content = message.cleanContent;
    //if (message.channel.name == 'general') console.log("Message");
    if (!message.author.bot) {

        //DMs
        if (message.channel instanceof Discord.DMChannel) {
            if (message.attachments.size > 0) {

                //Iterate over each attachment
                message.attachments.each(async attachment => {
                    //Checks if the attachment is an image
                    console.log(content);
                    if (isImage.test(attachment.name) && content.length > 0) {

                        //Tell the user that we're verifying.
                        message.channel.send("Verifying ... Please note this may take a while.");

                        let verified = await verify.verify(attachment.url, content);


                        //Return a verified/non-verified value.
                        message.channel.send(verified ? "You are verified!" : "That was not valid verification.");

                    } else {
                        console.log(JSON.stringify(attachment));
                        message.channel.send("To verify, send a full screenshot of your quest admissions screen, along with your full name. If you already have, please try again with a high-res image.");
                    }
                });
            } else {
                message.channel.send("To verify, send a full screenshot of your quest admissions screen, along with your full name. If you already have, please try again with a high-res image.");
            }
        }
        //Guild messages
        else {
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
}


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

