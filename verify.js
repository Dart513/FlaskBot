/**
 * Module: verify
 * Author: Glazed_Darnut
 * Version: 1.0.0
 * Description: A singleton class to export. Verifies a user from a screenshot of their quest info. Does not require Tesseract to be re-initialized each time it is run.
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
      await new Promise((resolve, reject) => this.fs.copyFile('./engBackup.traineddata', './eng.traineddata', resolve));

      const Tesseract = require('tesseract.js');

      const { createScheduler } = Tesseract;
      const { createWorker } = Tesseract;

      const scheduler = createScheduler({
      	logger: m => console.log(m)
      });

      this.https = require('https');                                            
      this.Stream = require('stream').Transform;                                
      
      this.sharp = require('sharp');

      //We're not expecting very many requests coming in per second, we're only going to have 2 workers.
      let workers = [createWorker({
        logger: m => console.log(m)
      }),
      createWorker({
        logger: m => console.log(m)
      }),
      //createWorker({
      //  logger: m => console.log(m)
      //}),
      //createWorker({
      //  logger: m => console.log(m)
      //})
    ];

      // Init the workers and add them to the scheduler.
      await Promise.all(workers.map(async worker => {
        console.log(await worker.load(), "done loading");
        console.log(await worker.loadLanguage('eng'), "done loading language");
        console.log(await worker.initialize('eng'), "done initializing");

        scheduler.addWorker(worker);
      }));
      
      //Make a worker pool for osd.

      let osdWorkers = [
        createWorker({
          logger: m=> console.log(m)
        })
      ];


      let osdScheduler = createScheduler({
        logger: console.log
      });

      // Init the workers and add them to the scheduler.
      await Promise.all(osdWorkers.map(async worker => {
        console.log(await worker.load(), "done loading");
        console.log(await worker.loadLanguage('eng'), "done loading language");
        console.log(await worker.initialize('eng'), "done initializing");

        osdScheduler.addWorker(worker);
      }));

      
      this.scheduler = scheduler;
      this.workers = workers;
      this.osdWorkers = osdWorkers;
      this.osdScheduler = osdScheduler;
    }

    /**
     * Runs OCR on the image
     * @param {String} img url to image 
     * @returns the text from the image
     */
    async recognize(img) {

      //grab the image
      let id = Math.random();
      let tempFile = path.join(__dirname, '/data/images/', `${id}.png`);
      
      await this.sharp(await this._fetchImage(img))
        .sharpen(5, 1.5, 2)
        .resize(2000)
        .toFile(tempFile);
      
      await this.isInitialized;
      console.log("New recognize job!");

      let responses = await Promise.all(
        (await this._sliceImage(tempFile, 250)).map(

          async (element) => {
            element = path.join(__dirname, '/data/images/', `${element}.png`);
            const { data: {text} } = await this.scheduler.addJob('recognize', element);
            this.fs.unlink(element, () => {});
            return text;
          }
      ));

      this.fs.unlink(tempFile, () => {});
      
      let text = responses.join(' ');

      console.log(text);
      return text;
    }

    async detect(img) {
      return await this.osdScheduler.addJob('detect', img);
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

    async _sliceImage(url, max) {
      const image = this.sharp(url);
      const metadata = await image.metadata();

      let w = metadata.width;
      let h = metadata.height;
      let sliceHeight = parseInt(max);
      console.log("SliceHeight", sliceHeight);
      let overlap = sliceHeight / 6;

      let slices = [];
      let promises = [];
      
      let iters = h / sliceHeight;
      for(let i = 0 ; i < iters; i++) {
        let id = Math.random();
        let height =  sliceHeight * (i+1) + overlap > h? h - sliceHeight * i: parseInt(sliceHeight + overlap);

        console.log("height", height, 'h', h, sliceHeight * i)

        promises.push(image.extract({
          left: 0, top: sliceHeight*i, width: w, height: height
        })
        .toFile(path.join(__dirname, '/data/images/', `${id}.png`)));

        slices.push(id);
      }

      await Promise.all(promises);

      return slices;
    }

    
    /**
     * Checks if the image matches the parameters decided
     * @param {String} img url to image
     * @param {String} name text input
     * @param {Object {
     *  regex: String
     *  script: (Optional) String
     * }} params parameters of the verification
     * @returns true/false
     */
    async verify(img, name, params) {

      //2 tests are attempted, one optional, one mandatory.

      let scriptMatch = true;
      if (params.script !== undefined) {
        scriptMatch = (params.script === (await this.detect(img)).data.script);
      }

      const text = await this.recognize(img);
    

      let [regex, flags] = params.regex.split("/");
      regex = regex.replace("${name}", name);

      const textVerifier = new RegExp(regex, flags);
      let textMatch = textVerifier.test(text);
      
      return (scriptMatch && textMatch);
    }

    /**
     * Shuts everything down.
     */
    async close() {
        await this.isInitialized;
        await Promise.all([this.workers.map(async worker => await worker.terminate()), this.osdWorkers.map(async worker => await worker.terminate())]);

    }

}

module.exports = Verify; 

/*let temp = new Verify();
temp._sliceImage('./data/images/0.0321310094626055.png',4).then(m => {
  console.log(m); 
  temp.close();
});*/
//temp.recognize('https://cdn.discordapp.com/attachments/835893922085339166/849748985816285194/unknown.png').then(res => console.log(res)).then(res => temp.close());