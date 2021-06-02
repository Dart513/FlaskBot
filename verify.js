/**
 * A singleton class to export. Verifies a user from a screenshot of their quest info. Does not require Tesseract to be re-initialized each time it is run.
 */

class Verify {

    //Make sure it's a singleton.
    constructor() {
        if (Verify.instance === undefined) {
            this.isInitialized = this.init();
            Verify.instance = this;
        }

        return Verify.instance;
    }

    //Initialize the only Tesseract.
    async init() {
      const createWorker = require('tesseract.js').createWorker;

      const worker = createWorker({
        logger: m => console.log(m)
      });
      
      await worker.load();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      const { data: { text } } = await worker.recognize('https://tesseract.projectnaptha.com/img/eng_bw.png');
      console.log(text);
      await worker.terminate();
      
        
    }

    async recognize() {
      await this.isInitialized;
      const { data: { text } } = await this.worker.recognize('https://ptb.discord.com/channels/826117425387929661/835893922085339166/849709092582195201');
      console.log(text);
    }

    async close() {
        await this.isInitialized;
        await this.worker.terminate();
    }

}

let temp = new Verify();
//temp.recognize();
temp.close();

module.exports = Verify; 


/*
const createWorker = require('tesseract.js').createWorker;

const worker = createWorker({
  logger: m => console.log(m)
});

(async () => {
  await worker.load();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
  const { data: { text } } = await worker.recognize('https://tesseract.projectnaptha.com/img/eng_bw.png');
  console.log(text);
  await worker.terminate();
})();
*/