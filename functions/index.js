const functions = require('firebase-functions');
const admin = require('firebase-admin');
const turf = require('@turf/turf');

admin.initializeApp();

var db = admin.database();
var usersRef = db.ref('/users');

/**
 * fetach near people.
 */
exports.fetchNearPeople = functions.https.onRequest((request, response) => {
  const myUserId = request.query.user_id;
  const myDeviceId = request.query.device_id;
  const radius = request.query.radius;

  usersRef.once('value', function(snapshot) {
    let allData = snapshot.val();

    let current_location = allData[myUserId]['devices'][myDeviceId].currentLocation;
    
    let myLat = current_location.latitude;
    let myLong = current_location.longitude;
    const myLocation = turf.point([myLat, myLong]);

    var arrResult = []
    Object.keys(allData).forEach(function(userId) {
      if (myUserId != userId) {
        let devices = allData[userId]["devices"];
        
        Object.keys(devices).forEach(function(deviceId) {
          let deviceInfo = devices[deviceId]
          let currentLocation = deviceInfo['currentLocation']
          if (currentLocation != undefined) {
            var to = turf.point([currentLocation.latitude, currentLocation.longitude]);
            var options = {units: 'kilometers'}
  
            var distance = turf.distance(myLocation, to, options);
  
            if (distance <= radius) {
              var isFollower = null
              let followers = allData[myUserId]['followers']
              if (followers) {
                Object.keys(followers).forEach(function(followerId) {
                  if (followerId == userId) {
                    isFollower = followers[followerId]
                  }
                });
              }
              
              let userInfo = {
                userId: userId,
                profile: allData[userId]["profile"],                  
                isFollower: isFollower
              }    
              arrResult.push(userInfo);
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

/**
 * send invite notification
 */
exports.sendFollowInviteNotification = functions.https.onRequest((request, response) => {
  const fromId = request.query.fromId;
  const toId = request.query.toId;

  var registrationTokens = [];

  usersRef.once('value', function(snapshot) {
    let allData = snapshot.val();

    let sender = allData[fromId];
    let receiver = allData[toId];
    
    let senderName = sender['profile']['name']
    
    let receiverDevices = receiver['devices'];
    Object.keys(receiverDevices).forEach(function(deviceId) {
      let deviceInfo = receiverDevices[deviceId]
      let fcmToken = deviceInfo['fcmToken']
      registrationTokens.push(fcmToken)
    });

    var payload = {
      notification: {
        title: '',
        body: senderName + ' has sent a request to follow you.'
      },
      data: {
        title: 'follow request'
      }
    };

    admin.messaging().sendToDevice(registrationTokens, payload).then(function(res) {
      console.log('Successfully sent message:', res);
      usersRef.child(fromId).child('followers').child(toId).set({
        accepted: false,
        declined: false
      });

      usersRef.child(toId).child('followings').child(fromId).set({
        accepted: false,
        declined: false
      });

      response.json({ result: 'success' });
    }).catch(function(error) {
      console.log('Error sending message:', error);
      response.json({ result: 'failed' });
    });
  }, function(errorObject) {
    console.log("The read failed: " + errorObject.code);
    response.json({ result: "failed" });
  });
});
