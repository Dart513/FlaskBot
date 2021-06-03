/**
 * A singleton class to export. Verifies a user from a screenshot of their quest info. Does not require Tesseract to be re-initialized each time it is run.
 */
const path = require('path');

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
      this.fs = require('fs');    
      //Make sure the training data was not corrupted
      this.fs.copyFileSync('./engBackup.traineddata', './eng.traineddata');

      const Tesseract = require('tesseract.js');

      const { createScheduler } = Tesseract;
      const { createWorker } = Tesseract;

      const scheduler = createScheduler();

      this.https = require('https')                                            
      this.Stream = require('stream').Transform                                 
      
      this.sharp = require('sharp');




      //We're not expecting very many requests coming in per second, we're only going to have 2 workers.
      let workers = [createWorker({
        logger: m => console.log(m)
      })];
      //createWorker({
        //logger: m => console.log(m)
      //})];

      // Init the workers and add them to the scheduler.
      await Promise.all(workers.map(async worker => {
        console.log(await worker.load(), "done loading");
        console.log(await worker.loadLanguage('eng'), "done loading language");
        console.log(await worker.initialize('eng'), "done initializing");

        scheduler.addWorker(worker)
      }));
      
      
      this.scheduler = scheduler;
      this.workers = workers;
    }

    /**
     * Runs OCR on the image
     * @param {String} img url to image 
     * @returns the text from the image
     */
    async recognize(img) {

      //grab the image

      //let id = Math.random();
      //let tempFile = path.join(__dirname, '/data/images/', `${id}.png`);
      /*
      await this.sharp(await this._fetchImage(img))
        .sharpen(5, 1.5, 2)
        .resize(2000)
        .toFile(tempFile);
      */

      await this.isInitialized;
      const { data: { text } } = await this.scheduler.addJob('recognize', img);
      console.log("Text:", text);

      //this.fs.unlink(tempFile, () => {});
      
      return text;
    }


    /**
     * Fetches an image from a url.
     * @param {String} url 
     * @returns Buffer
     */
    async _fetchImage(url) {
      let self = this;
      return new Promise( (resolve, reject) => {
        self.https.request(url, function(response) {                                        
          var data = new self.Stream();                                                    
        
          response.on('data', function(chunk) {                                       
            data.push(chunk);                                                         
          });                                                                         
        
          response.on('end', function() {                                             
            resolve(data.read());                              
          });                                                                         
        }).end();
      });
    }

    
    /**
     * Checks if the image matches an intention to matriculate
     * @param {String} img url to image
     * @param {String} name name of person
     * @returns true/false
     */
    async verify(img, name) {
      const text = await this.recognize(img);
      const isVerification = new RegExp(`((?=.*?matriculate.*?)(?=.*?intention.*?)(?=.*?mechatronics.*?)(?=.*?honours.*?)(?=.*?co-op.*?)(?=.*?${name}.*?))`, 'gmsi');
      return (isVerification.test(text));
    }

    /**
     * Shuts everything down.
     */
    async close() {
        await this.isInitialized;
        await Promise.all[this.workers.map(async worker => await worker.terminate())];

    }

}

module.exports = Verify; 

//let temp = new Verify();

//temp.recognize('https://cdn.discordapp.com/attachments/835893922085339166/849748985816285194/unknown.png').then(res => console.log(res)).then(res => temp.close());