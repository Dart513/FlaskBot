module.exports = new class Singleton {

    constructor() {
        if (!Singleton.instance) {
            Singleton.instance = new db();
        }

        return Singleton.instance();
    }

}



async function init(self) {
    await self._dbInit();
    try {
        await client.connect();

        await client.db("historicalPriceData").command({ ping: 1 });
        await client.db("userData").command({ ping: 1 });
        console.log("Connected successfully to server");
    } finally {
        // Set up databases
        self.dbs["userData"] = client.db("userData");
        self.dbs["historicalPriceData"] = client.db("historicalPriceData");
        self.db = client;

        function logConsequentialErrors(error) {
            //ignore the error if it's just that we're trying to init a collection that already exists
            if (!error) return;
            if (error.code !== 48) console.error(error.message); 
        }

        // Create counter collections
        self.dbs.userData.createCollection("counters", logConsequentialErrors);
        self.dbs.historicalPriceData.createCollection("counters", logConsequentialErrors)

        // Create other collections
        self.dbs.userData.createCollection("trades", logConsequentialErrors);
        self.dbs.userData.createCollection("status", logConsequentialErrors);

        // Decimate old data older than 12 hours
        //await self.destroyHistoricalPriceDataOlderThan.call(self, 1000 * 60 * 60 * 12);

        await self.indexes.init(self.dbs);
    }
}

async function _dbInit() {
    var portscanner = require('portscanner');
    var status = await portscanner.checkPortStatus(20499, '127.0.0.1');
    if (status == 'open') return;
    this.mongoProc = this.spawn("data/mongodb/bin/mongod.exe", ["--dbpath", "data/db/data", "--port", "20499"]);
    return new Promise((resolve, reject) => {

        this.mongoProc.stdout.on("data", data => {

            data = data.toString().split("\r\n"); ///splitJSON(data.toString());
            data.pop();
            //console.info("result: ", data);
            
            data.forEach(element => {
                element = JSON.parse(element);
                info(new Date(Date.parse(element['t']['$date'])).toString(), "db stdout:", JSON.stringify(element, null, 2));
                if (element.msg.includes("Waiting for connections")) {
                    console.log("DONE WAITING");
                    resolve();
                }
            });
            
            
            
        });
        
        this.mongoProc.stderr.on("data", data => {
            data = data.toString().split("\r\n"); ///splitJSON(data.toString());
            data.pop();
        
            data.forEach(element => {
            element = JSON.parse(element);
            error(new Date(Date.parse(element['t']['$date'])).toString(), "db stderr:", element.msg);
            }); 
        });
        
        this.mongoProc.on('error', (error) => {
            error(new Date(Date.now()).toString(), "db error:", error.message);
            reject(error);
        });
        
        this.mongoProc.on("close", code => {
            log(new Date(Date.now()).toString(), "DB CLOSE: ", code);
            reject("closed");
        });
    });
}
