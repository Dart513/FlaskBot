const { timeStamp } = require('console');
const fs = require('fs');
const path = require('path');


class flatDataManager {


    constructor() {
        //Open file

        this.dataPath = path.join(__dirname, 'data', 'flat.json');

        //Make sure file exists. If it doesn't pre-seed it with some data.
        this.init();
    }

    init() {
        try {
            this.data = JSON.parse(
                fs.readFileSync(this.dataPath, 'utf-8'));
    
            } catch (error) {
    
                this.data = {
                    GUILDS: {},
                    GLOBAL: {
                        commands: {},
                        replacements: [],
                    }
                }
    
                //fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
            }
    
            //this.saveInterval = setInterval(this.save, 5 * 60 * 1000);
    
            //Load up all the replacements for each guild
            this.replacements = new Map();
    
            Object.keys(this.data.GUILDS).forEach(guildId => {
                this.getReplacementsForGuild(guildId);
            });
    }

    addGuild(guildId, name) {
        if (this.data.GUILDS[guildId] === undefined) this.data.GUILDS[guildId] = {};
        this.data.GUILDS[guildId].name = name;
    }

    getCommandsForGuild(guildId) {
        return Object.assign({}, this.data.GLOBAL.commands, this.data.GUILDS[guildId].commands);
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
            let temp = [].concat(copyObj(this.data.GLOBAL.replacements), copyObj(this.data.GUILDS[guildId].replacements)).filter(element => element !== undefined); 

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

    save() {
        fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, "  "));
    }

    reload() {
        this.init();
    }

    close() {
        //clearInterval(this.saveInterval);
        this.save();
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