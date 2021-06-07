/**
 * Module: flatDataManager
 * Author: Glazed_Darnut
 * Version: 1.1.0
 * Description: To store data in JS object-like format and run on a Raspberry Pi 
 */

//Config are config files while the files under Guilds are data files.

const { timeStamp } = require('console');
const fs = require('fs');
const path = require('path');

const TEMP_DATA_PURGE_TIME = 5 * 60 * 1000;
const STOP_PENDING_AFTER = 25 * 60 * 1000;

function mkDirIfNotExists() {
    let args = Array.from(arguments);
    try {
        fs.mkdirSync(path.join.apply(null, args, {recursive: true}));
    }
    catch (ignored) {
    }
}

class flatDataManager {


    constructor() {
    
        const baseDir = path.join(__dirname, 'data'); 

        //Set up paths
        this.configPath = path.join(baseDir, 'config.json');
        this.baseGuildPath = path.join(baseDir, 'guilds');
        
        //Make necessary directories
        mkDirIfNotExists(this.baseGuildPath);
        mkDirIfNotExists(baseDir, 'images');

        
        //Make sure config file exists. If it doesn't pre-seed it with some data.
        this.init();
    }

    init() {
        try {
            this.config = JSON.parse(
                fs.readFileSync(this.configPath, 'utf-8'));
            } catch (error) {
    
                this.config = {
                    GUILDS: {},
                    GLOBAL: {
                        commands: {},
                        replacements: [],
                    }
                }
    
                //fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2));
            }
    
            //this.saveInterval = setInterval(this.save, 5 * 60 * 1000);
    
            //Load up all the replacements for each guild
            this.replacements = new Map();
    
            Object.keys(this.config.GUILDS).forEach(guildId => {
                this.getReplacementsForGuild(guildId);
            });
    }

    addGuild(guildId, name) {
        if (this.config.GUILDS[guildId] === undefined) this.config.GUILDS[guildId] = {};
        this.config.GUILDS[guildId].name = name;
    }

    checkExpiry(guildId) {
        
        if (Date.now() > this.data[guildId].expiry) {
            this.unloadGuildData(guildId);
        } 
        else {
            this.saveGuildData(guildId);
        }
    }

    /**
     * Fetches a guild's data from memory or flat file storage.
     * If the guild's data is not used for a while, it will be saved to disk, then removed from memory to save memory.
     * 
     * This function will reset the expiry timer.
     * Use this function to get guild data, to then modify.
     */
    fetchGuildData(guildId) {
        if (this.data === undefined) {
            this.data = [];
        }
        if (this.data[guildId] === undefined) {
            try {
                const guildPath = path.join(this.baseGuildPath, `${guildId}.json`);
                this.data[guildId] = JSON.parse(
                    fs.readFileSync(guildPath, 'utf-8'));
            } catch (error) {
                this.data[guildId] = {}
            }
        }

        //Set a time for the guild data to be wiped from memory.
        
        this.data[guildId].expiry = Date.now() + TEMP_DATA_PURGE_TIME;

        if (this.data[guildId].saveTimer === undefined) {
            this.data[guildId].saveTimer = setInterval(this.checkExpiry.bind(this, String(guildId)), 60000);
        }

        return this.data[guildId];
    }


    saveGuildData(guildId) {
        const guildPath = path.join(this.baseGuildPath, `${guildId}.json`);
        let saveObj = {};

        saveObj = Object.fromEntries(
            Object.entries(this.data[guildId]).filter(entry => {
                return entry[0] !== "saveTimer";
        }));


        fs.writeFileSync(guildPath, JSON.stringify(saveObj, null, "  "));
    }

    unloadGuildData(guildId) {
        this.saveGuildData(guildId);
        clearInterval(this.data[guildId].saveTimer);
        delete this.data[guildId];
        console.log(this.data);
    }

    getCommandsForGuild(guildId) {
        return Object.assign({}, this.config.GLOBAL.commands, this.config.GUILDS[guildId].commands);
    }

    /**
     * Get the replacements to listen for for the guild
     * @param {*} guildId 
     * @returns {
     * {String} result:,
     * {Regex} replacement,
     * }
     */
    getReplacementsForGuild(guildId) {
        if (this.replacements.get(guildId) === undefined) {

            //Smush together the global replacements and the guild-specific ones
            let temp = [].concat(copyObj(this.config.GLOBAL.replacements), copyObj(this.config.GUILDS[guildId].replacements)).filter(element => element !== undefined); 

            //make replacements for the guild
            let replacements = temp.map((element) => {
                
                let result = {
                    result: element.result,
                    options: [],
                }

                let matcher = element.triggers;

                let regstr = '(?:'

                //build the regex for each replacement
                for (let i = 0; i < matcher.length ; i++) {
                    if (i !== 0 && i !== matcher.length) {
                        regstr+='|';
                    }
                    regstr+=matcher[i];
                }

                regstr += ")";



                //Optional args
                //Split options string into array
                element.options = element.options.split(" "); 

                if (element.options.includes('!emotes')) {
                    regstr = `(?<![:])${regstr}(?![:])`;
                }

                if (element.options.includes('replacePartial')) {
                    result.options.replacePartial = true;
                } else {
                    regstr = `(?<!.)${regstr}(?!.)`;
                }

                let flags = "";

                element.options.forEach(option => {
                    if (option.charAt(0) == '/') { //make sure it's a flag
                        flags += option.substring(1);
                    }
                })

                result.regex = new RegExp(regstr, flags);

                return result;

            });

            this.replacements.set(guildId, replacements);
            return replacements;

        }
        else return this.replacements.get(guildId);
    }

    /**
     * Checks if a user is verified in a guild
     * @param {Integer} guildId 
     * @param {Snowflake} userId 
     * @returns -1 for no, 0 for pending, 1 for verified.
     */
    isVerified(guildId, userId) {

        let guildData = this.fetchGuildData(guildId);

        if (guildData.verified === undefined || guildData.verified[userId] === undefined) {
            return -1;
        }

        let status = guildData.verified[userId].status;
        
        switch(status) {
            case undefined:
                return -1;
                
            case "pending":
                if (Date.now() - guildData.verified[userId].time > STOP_PENDING_AFTER) {
                    delete guildData.verified[userId];
                    return -1;
                }
                else return 0;

            case "verified":
                return 1;
        }
    }

    /**
     * Sets the verified status for a user in a guild. This function will store the verified status in a human-readable format.
     * @param {Integer} guildId 
     * @param {Snowflake} userId 
     * @param {Integer} status -1, 0 or 1 
     * @param {String} username optional
     */
    setVerified(guildId, userId, status, username) {
        let guildData = this.fetchGuildData(guildId);
        if (guildData.verified === undefined) {
            guildData.verified = {};
        }

        switch(status) {
            case -1:
                delete guildData.verified[userId];
                break;
            case 0:
                guildData.verified[userId] = {
                    status: "pending",
                    time: Date.now(),
                    username: username
                };
                break;
            case 1:
                guildData.verified[userId] = {
                    status: "verified",
                    time: Date.now(),
                    username: username
                };
                break;
        }
    }


    saveConfig() {
        fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, "  "));
    }

    reload() {
        this.init();
    }

    close() {
        //clearInterval(this.saveInterval);
        if (this.data !== undefined) {
            Object.keys(this.data).forEach(guildId => {
                this.unloadGuildData(guildId);
            });
        }

        this.saveConfig();
    }
}

/**
 * Deep copies an object
 * @param {} obj 
 */
function copyObj(obj) {
    if (obj === undefined) return undefined;

    return JSON.parse(JSON.stringify(obj));
}

let fdm = new flatDataManager();
fdm.close();


module.exports = flatDataManager;