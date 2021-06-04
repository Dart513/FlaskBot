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

      const scheduler = createScheduler({
	logger: m => console.log(m)
      });

      this.https = require('https');                                            
      this.Stream = require('stream').Transform;                                
      
      this.sharp = require('sharp');
      this.Jimp = require('jimp');



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

/*let temp = new Verify();
temp._sliceImage('./data/images/0.0321310094626055.png',4).then(m => {
  console.log(m); 
  temp.close();
});*/
//temp.recognize('https://cdn.discordapp.com/attachments/835893922085339166/849748985816285194/unknown.png').then(res => console.log(res)).then(res => temp.close());