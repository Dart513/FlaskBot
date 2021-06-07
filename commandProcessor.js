/**
 * Module: commandProcessor
 * Author: Glazed_Darnut
 * Version: 1.0.1
 * Description: A module whose sole purpose is to process commands.
 * 
 */

const { charAt } = require("ffmpeg-static");

let Discord, fdm, verify, client;
//Checks if a string matches an image
const isImage = new RegExp("(png|jpg|jpeg)(?!\.)", "gmi");


const GUILD_NOT_FOUND_MESSAGE = "I couldn't find any server called ${guild_name}. Please be aware that capitalization counts!";
const VERIFY_HELP_MESSAGE = `To verify with a server, send a message with the following format: \`verify \"<server_name>\" \"<role>\"\`.
If the server has set up OCR verification, more help will be provided.`;
const NO_ROLE_MESSAGE = "The role requested could not be found.";
const NO_GENERAL_VERIFY_HELP = "This server has not set a general verification help message.";
const NO_SPECIFIC_VERIFY_HELP = "This server has not set a general nor role-specific help message. However, this role is verifiable.";
const NO_IMAGE_VERIFY_HELP = "The verification process needs to have an image of png or jpg format attached."

module.exports = class commandProcessor {

    /**
     * Constructor for dependency injection
     * @param {Object} dependencies
     * {
     *   Discord: Discord,
     *   fdm: flatDataManager,
     *   verify: verify,
     *   client: client
     * }
     */
    constructor(dependencies) {
        Discord = dependencies.Discord;
        fdm = dependencies.fdm;
        verify = dependencies.verify;
        client = dependencies.client;
    }

    /**
     * Processes an incoming message
     * @param {Message} message 
     */
    async processMsg(message) {
        let content = message.cleanContent;
        let oldContent = content;
        let userId = message.author.id;
        let username = message.author.username;
        
        if (!message.author.bot) {
            //DMs
            if (message.channel instanceof Discord.DMChannel) {
                
                //Do not allow anyone who is already verified to re-verify.

                let commandArgs = content.split(" ");


                //Switch on command word
                switch (commandArgs[0].toLowerCase()) {
                    case "verify":

                        //Re-split command args based on "
                        commandArgs = content
                        .split("\"")
                        .map(element => {
                            if (element.charAt(0) === ' ') element = element.substr(1);
                            if (element.charAt(element.length - 1) === ' ') element = element.substr(0, element.length - 1);

                            return element;
                        }).filter(element => element.length > 0);

                        //Make sure command is still valid.
                        if (commandArgs.length === 1 && commandArgs[0] !== "verify") {
                            message.channel.send("The syntax of the verify command was invalid. " + VERIFY_HELP_MESSAGE);
                            return;
                        };
                       

                        console.log("commandargs", commandArgs);

                        //Check length
                        let requestedRole, guildId;

                        switch(commandArgs.length) {
                            // 'verify'
                            case 1:
                                message.channel.send(VERIFY_HELP_MESSAGE);
                                break;
                            
                            // 'verify' 'guild'
                            case 2:
                                if (await this.__checkGuildUserCombo(commandArgs, userId, message)) {
                                    //If the guild is valid, do shit
                                    guildId = client.guilds.cache.find(guild => guild.name === commandArgs[1]).id;
                                    message.channel.send(await this.__getGeneralVerifyHelp(guildId));
                                }
                                break;
                            
                            // 'verify' 'guild' 'role'
                            case 3:
                                //Make sure the guild exists and the user is in the guild
                                if (!(await this.__checkGuildUserCombo(commandArgs, userId, message))) break;

                                guildId = client.guilds.cache.find(guild => guild.name === commandArgs[1]).id;

                                //check if the guild has the role available.
                                requestedRole = commandArgs[2];
                                if (!fdm.config.GUILDS[guildId].verification[requestedRole]) {
                                    message.channel.send(NO_ROLE_MESSAGE);
                                    break;
                                }
                                
                                message.channel.send(await this.__getSpecificVerifyHelp(guildId, requestedRole));
                                break;
                            
                            // 'verify' 'guild' 'role' '
                            case 4:
                                //make sure the guild exists, user is in guild
                                if (!(await this.__checkGuildUserCombo(commandArgs, userId, message))) break;

                                let guild = client.guilds.cache.find(guild => guild.name === commandArgs[1]);
                                guildId = guild.id;
                                
                                //check if guild has role available
                                requestedRole = commandArgs[2];
                                if (!fdm.config.GUILDS[guildId].verification[requestedRole]) {
                                    message.channel.send(NO_ROLE_MESSAGE);
                                    break;
                                }

                                
                                //verify
                                switch (fdm.isVerified(guildId, userId)) {
                                    case 0:
                                        message.channel.send("We are currently verifying your request. Please be patient.");
                                        return;
                                    case 1:
                                        //Check if the verification was undone
                                        if (!(await this.__hasRole(guild, userId, requestedRole))) {
                                            fdm.setVerified(guildId, userId, -1, message.author.username);
                                            break;
                                        } else {
                                            message.channel.send("You have already been verified! You cannot re-verify.");
                                            return;
                                        }
                                        break;
                                    case -1:
                                        if (!(await this.__hasRole(guild, userId, requestedRole))) {
                                            break;
                                        } else {
                                            fdm.setVerified(guildId, userId, 1, message.author.username);
                                            message.channel.send("You already have this role! You cannot verify.");
                                            return;
                                        }
                                }
                                

                                //Make sure that the verification has an image
                                if (message.attachments.size > 0) {

                                    //Iterate over each attachment
                                    message.attachments.each(async attachment => {

                                        //Checks if the attachment is an image
                                        //Wait a few millis for the attachment to finish resolving
                                        await new Promise((resolve, reject) => {
                                            setTimeout(resolve, 10);
                                        });
                                        
                                        console.log(attachment);
                                        let doContinue = isImage.test(attachment.name);
                                        if (doContinue) {

                                            //Tell the user that we're verifying.
                                            message.channel.send("Verifying ... Please note this may take a while.");
                                            fdm.setVerified(guildId, userId, 0);

                                            let verified = await verify.verify(attachment.url, commandArgs[3], fdm.config.GUILDS[guildId].verification[requestedRole]);


                                            //Return a verified/non-verified value.
                                            if (verified) {
                                                fdm.setVerified(guildId, userId, 1, username);
                                                //assign role
                                                await this.__addRoleByName(guild, userId, requestedRole);
                                                message.channel.send("You have been verified!");
                                            }
                                            else {
                                                fdm.setVerified(guildId, userId, -1, username);
                                                message.channel.send("Invalid verification!");
                                            }
                                            

                                        } else {
                                            console.log(JSON.stringify(attachment));
                                            console.log(isImage.test(attachment.name), doContinue);
                                            message.channel.send(NO_IMAGE_VERIFY_HELP);
                                        }
                                    });
                                } else {
                                    message.channel.send(NO_IMAGE_VERIFY_HELP);
                                }
                                
                                
                                break;

                            default:
                                message.channel.send("Invalid syntax.");
                            }
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


    /**
     * Checks if the user and the guild are valid
     * @param {*} commandArgs 
     * @param {*} userId 
     * @returns {boolean}
     */
    async __checkGuildUserCombo(commandArgs, userId, message) {
        //check if the guild is correct.
        let requestedGuild = client.guilds.cache.find(guild => guild.name === commandArgs[1]);

        //Make sure guild exists and the user is in the guild
        if (requestedGuild === undefined || await requestedGuild.members.fetch(userId) === undefined) {
            message.channel.send(GUILD_NOT_FOUND_MESSAGE.replace("${guild_name}", commandArgs[1]));
            return false;
        }

        return true;
    }

    async __getGeneralVerifyHelp(guildId) {
        let helpMessage = fdm.config.GUILDS[guildId].help_messages.verification.__default;
        if (helpMessage === undefined) {
            helpMessage = NO_GENERAL_VERIFY_HELP;
        }
       return helpMessage;
    }

    async __getSpecificVerifyHelp(guildId, role) {

        //check if the guild has a role-specific verification help message
        let helpMessage = fdm.config.GUILDS[guildId].help_messages.verification[role];
        
        if (helpMessage === undefined) {
            helpMessage = this.__getGeneralVerifyHelp(guildId);
            if (helpMessage === NO_GENERAL_VERIFY_HELP) {
                helpMessage = NO_SPECIFIC_VERIFY_HELP;
            }
        }

        return helpMessage;

    }

    async __addRoleByName(guild, userId, roleName) {
        let member = await guild.members.fetch({ user: userId, force: true, limit: 1});
        let role = guild.roles.cache.find(role => role.name === roleName);
        await member.roles.add(role);
    }

    async __hasRole(guild, userId, roleName) {
        let member = await guild.members.fetch({ user: userId, force: true, limit: 1});
        let role = guild.roles.cache.find(role => roleName === role.name);
        let ret = member.roles.cache.has(role.id);
        return ret;
    }

}