const functions = require('firebase-functions');
const admin = require('firebase-admin');
const turf = require('@turf/turf');

admin.initializeApp();

var db = admin.database();
var usersRef = db.ref('/users');

exports.fetchNearPeople = functions.https.onRequest((request, response) => {
  const myUserId = request.query.user_id;
  const myDeviceId = request.query.device_id;
  const radius = request.query.radius;

  usersRef.once('value', function(snapshot) {
    let allData = snapshot.val();

    let current_location = allData[myUserId][myDeviceId].currentLocation;
    
    let myLat = current_location.latitude;
    let myLong = current_location.longitude;
    const myLocation = turf.point([myLat, myLong]);

    var arrResult = []
    Object.keys(allData).forEach(function(userId) {
      if (myUserId != userId) {
        let userData = allData[userId]
        Object.keys(userData).forEach(function(deviceId) {
          if (deviceId != 'profile' && deviceId != 'followers') {
            let deviceInfo = userData[deviceId]
            let currentLocation = deviceInfo['currentLocation']
            if (currentLocation != undefined) {
              var to = turf.point([currentLocation.latitude, currentLocation.longitude]);
              var options = {units: 'kilometers'}
    
              var distance = turf.distance(myLocation, to, options);
    
              if (distance <= radius) {
                var isFollowing = null
                let followers = allData[myUserId]['followers']
                if (followers) {
                  Object.keys(followers).forEach(function(followerId) {
                    if (followerId == userId) {
                      isFollowing = followers[followerId]
                    }
                  });
                }
                
                let userInfo = {
                  userId: userId,
                  profile: userData["profile"],                  
                  isFollowing: isFollowing
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

exports.sendInviteNotification = functions.https.onRequest((request, response) => {
  const fromId = request.query.fromId;
  const toId = request.query.toId;

  var registrationTokens = [];

  usersRef.once('value', function(snapshot) {
    let allData = snapshot.val();

    let sender = allData[fromId];
    let receiver = allData[toId];
    
    let senderName = sender['profile']['name']
    
    var arrResult = []
    Object.keys(receiver).forEach(function(deviceId) {
      if (deviceId != 'profile' && deviceId != 'followers') {
        let deviceInfo = receiver[deviceId]
        let fcmToken = deviceInfo['fcmToken']
        registrationTokens.push(fcmToken)
      }
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

exports.getFollowingRequests = functions.https.onRequest((request, response) => {
  const myUserId = request.query.userId

  usersRef.once('value', function(snapshot) {
    let allData = snapshot.val();

    var arrResult = []
    Object.keys(allData).forEach(function(userId) {
      if (myUserId != userId) {
        let followers = allData[userId]['followers']
        if (followers != undefined) {
          Object.keys(followers).forEach(function(followerId) {
            if (followerId == myUserId) {
              let profile = allData[userId]['profile']
              let userName = ''
              if (profile != undefined) {
                userName = profile['name']
              }
              let status = followers[followerId]
              if (status.accepted == false && status.accepted == false) {
                let follower = {
                  userId: userId,
                  userName: userName,
                  status: followers[followerId]
                }
                arrResult.push(follower)
              }              
            }
          });
        }
      }
    });

    response.json({ result: arrResult });
    
  }, function(errorObject) {
    console.log("The read failed: " + errorObject.code);
    response.send("The read failed: " + errorObject.code);
  });
});