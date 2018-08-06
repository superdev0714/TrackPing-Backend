const functions = require('firebase-functions');
const admin = require('firebase-admin');
const turf = require('@turf/turf');

admin.initializeApp();

var db = admin.database();
var rootRef = db.ref("/users");

exports.fetchNearPeople = functions.https.onRequest((request, response) => {
  const user_id = request.query.user_id;
  const device_id = request.query.device_id;
  const radius = request.query.radius;

  rootRef.once('value', function(snapshot) {
    let allData = snapshot.val();

    let current_location = allData[user_id][device_id].currentLocation;
    
    let myLat = current_location.latitude;
    let myLong = current_location.longitude;
    const myLocation = turf.point([myLat, myLong]);

    var arrResult = []
    Object.keys(allData).forEach(function(userId) {
      if (user_id != userId) {
        let userData = allData[userId]
        Object.keys(userData).forEach(function(deviceId) {
          if (deviceId != "profile") {
            let deviceInfo = userData[deviceId]
            let currentLocation = deviceInfo['currentLocation']
            if (currentLocation != undefined) {
              var to = turf.point([currentLocation.latitude, currentLocation.longitude]);
              var options = {units: 'kilometers'};
    
              var distance = turf.distance(myLocation, to, options);
              console.log('distance:', distance)
    
              if (distance <= radius) {
                let userInfo = {
                  userId: userId,
                  deviceId: deviceId,
                  profile: userData["profile"],
                  currentLocation: currentLocation
                }    
                arrResult.push(userInfo);
              }            
            }
          }
        });
      }
    });

    response.json({ result: arrResult });
    
  }, function(errorObject) {
    console.log("The read failed: " + errorObject.code);
    response.send("The read failed: " + errorObject.code);
  });
});
