var express = require("express"),
    sql     = require("../models/sql"),
    //request = require("request"),
    router = express.Router();

var validator = require("validator");



//******************Time Card*********************//
Date.prototype.subDays = function(days) {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() - days);
    return date;
};

Date.prototype.addDays = function(days) {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
};

Number.prototype.toFixedDown = function(digits) {
    var re = new RegExp("(\\d+\\.\\d{" + digits + "})(\\d)"),
        m = this.toString().match(re);
    return m ? parseFloat(m[1]) : this.valueOf();
};

function getClocksForToday(req, res, next){

	var today = new Date();                           //get today
	var daysTillSatuday = 6 - today.getDay();         //figure out what day of the week it is
	var thisSaturday = today.addDays(daysTillSatuday); //get upcoming saturday of this week by taking 6 - today add that many days

	req.numberOfWeeks = 4

	req.clockArray = []

	for(var w=req.numberOfWeeks-1; w>-1; w--){
		var startNumber = 7 * w;
		var startDay = 27 - startNumber;

		
		for(var d=5; d>0; d--){
			var numDaysToSub = startDay - d;
			var workingDay = thisSaturday.subDays(numDaysToSub);
			var month = workingDay.getMonth() + 1;
			var queryDate = workingDay.getFullYear()+"-"+month+"-"+workingDay.getDate();


			let todayClocks = new Promise((resolve, reject) => {
				resolve({week:w, day:d, queryDate:queryDate, date:workingDay});
			});

			todayClocks.then(
				function(date){
					sql.query("SELECT * FROM timecard"+req.user.ID+" WHERE date = '"+date.queryDate+"'", function(err, result){
						if(err) reject(err);
						if(result.length > 0){
							req.clockArray.push({week:date.week, date:date.date, day:date.day, clock1:result[0], clock2:result[1], clock3:result[2], clock4:result[3]});

							if(date.week == 0 && date.day == 1){
								return next();
							}
						} else {
							req.clockArray.push({week:date.week, date:date.date, day:date.day, clocks:[]});
							if(date.week == 0 && date.day == 1){
								return next();
							}
						}



					});
				}
			).catch((reason) =>{
				console.log("REJECT "+reason);
			});
		}
	}
}

function getLastClock(req, res, next){
	var today = new Date();
	var month = today.getMonth() + 1;
	var todaysDate = today.getFullYear()+"-"+month+"-"+today.getDate();

	sql.query("SELECT * FROM timecard"+req.user.ID+" WHERE date = '"+todaysDate+"' ORDER BY ID DESC LIMIT 1", function (err, result){
		if(err) throw err;
		if(result.length > 0){
			req.lastClock = result[0].type;
			return next();
		} else {
			req.lastClock = "OUT"
			return next();
		}
	});
}

function getRequests(req, res, next){
	var date = new Date();
	var otherDate = date.subDays(14);
	var dateMonth = date.getMonth() + 1;
	var otherDateMonth = otherDate.getMonth() + 1;
	var endDate = date.getFullYear()+'-'+dateMonth+'-'+date.getDate();
	var startDate = otherDate.getFullYear()+'-'+otherDateMonth+'-'+otherDate.getDate();

	sql.query("SELECT * FROM timeEditRequests WHERE user_id = '"+req.user.ID+"' AND (clockDate BETWEEN CAST('"+startDate+"' AS DATE) AND CAST('"+endDate+"' AS DATE) )", function(err, result){
		if(err) throw err;
		req.requests = result;
		return next();
	})
}

router.get('/timecard', isLoggedIn, notifications,  getClocksForToday, getLastClock, getRequests, function(req, res){
  res.render('timecard', {currentUser:req.user, notifications:req.notifications,  clocks:req.clockArray, weeks:req.numberOfWeeks, requests:req.requests, lastClock:req.lastClock});
});


router.post('/timecard/clock-in', isLoggedIn, notifications,  function(req, res){
	var today = new Date();
	var month = today.getMonth() + 1;
	var todaysDate = today.getFullYear()+"-"+month+"-"+today.getDate();
	var minutes = today.getMinutes();
	var hour = today.getHours();
	var minuteValue = minutes/60;
	var totalValue = hour + minuteValue.toFixedDown(2);

	sql.query("INSERT INTO timecard"+req.user.ID+" (date, type, hour, minutes, day, value) VALUES('"+todaysDate+"', 'IN', '"+hour+"', '"+minutes+"', '"+today.getDay()+"', '"+totalValue+"')", function(err, result){
		if(err) throw err;
		return res.redirect('/timecard');
	});

});

router.post('/timecard/clock-out', isLoggedIn, notifications,  function(req, res){
	var today = new Date();
	var month = today.getMonth() + 1;
	var todaysDate = today.getFullYear()+"-"+month+"-"+today.getDate();
	var minutes = today.getMinutes();
	var hour = today.getHours();
	var minuteValue = minutes/60;
	console.log(minuteValue.toFixedDown(2));
	var totalValue = hour + minuteValue.toFixedDown(2);

	sql.query("INSERT INTO timecard"+req.user.ID+" (date, type, hour, minutes, day, value) VALUES('"+todaysDate+"', 'OUT', '"+hour+"', '"+minutes+"', '"+today.getDay()+"', '"+totalValue+"')", function(err, result){
		if(err) throw err;
		return res.redirect('/timecard');
	});

});

function getTimeCardInfo(req, res, next){
	sql.query('SELECT * FROM timecard'+req.user.ID+' WHERE ID = "'+req.params.id+'"', function(err, result){
		if(err) throw err;
		req.info = result[0];
		return next();
	});
}

router.get('/timecard/timecardId=:id&pos=:pos', isLoggedIn, notifications, getTimeCardInfo, function(req, res, next){
	res.render('timecardeditexists', {currentUser:req.user, notifications:req.notifications,  pos:req.params.pos, clock:req.info});
});

function testPost(req, res, next){
	console.log('test post')
	var date = new Date(req.body.date)
	var month;
	var day;
	var minuteValue = parseInt(req.body.minutes)/60;
	console.log(req.body.meridies);
	if(req.body.meridies == 'PM' && parseInt(req.body.hour) < 12){
		var hour = parseInt(req.body.hour) + 12;
	} else {
		var hour = parseInt(req.body.hour);
	}
	console.log(hour)
	var totalValue = hour + minuteValue.toFixedDown(2);

	if(date.getMonth() < 10){
		month = '0'+(date.getMonth()+1);
	} else {
		month = date.getMonth() + 1;
	}

	if(date.getDate() < 10){
		day = '0'+ (date.getDate());
	} else {
		day = date.getDate();
	}

	var updatedDate = date.getFullYear()+'-'+month+'-'+day;

	if(req.user.ID == 1){
		sql.query(`UPDATE timecard`+req.user.ID+`  SET
							date = '`+updatedDate+`',  
							hour = '`+hour+`',  
							minutes = '`+req.body.minutes+`', 
							day = '`+date.getDay()+`', 
							value = '`+totalValue+`' WHERE ID = `+req.params.id, 
		function(err, result){
			if(err) throw err;
			req.flash('success', 'Clock edit success', false);
			res.redirect('/timecard');
		});
	} else {
		var todaysDate = new Date();
		var todaysMonth = todaysDate.getMonth() + 1;
		var todaysFullDate = todaysDate.getFullYear()+"-"+todaysMonth+"-"+todaysDate.getDate();
		sql.query(`INSERT INTO timeEditRequests (`
								+`user_id, `
								+`type, `
								+`clockID, `
								+`clockDate, `
								+`clockType, `
								+`hour, `
								+`minutes, `
								+`day, `
								+`date, `
								+`comment, `
								+`pos, `
								+`value) VALUES ('`
								+req.user.ID+`', '`
								+`edit', '`
								+req.params.id+`', '`
								+updatedDate+`', '`
								+req.params.type+`', '`
								+hour+`', '`
								+req.body.minutes+`', '`
								+date.getDay()+`', '`
								+todaysFullDate+`', '`
								+validator.escape(req.body.comment)+`', '`
								+req.params.pos+`', '`
								+totalValue+`') `,
			function(err, result){
				if(err) throw err;
					req.flash('success', 'Clock edit request sent', false);
					res.redirect('/timecard');
			});
	}
}

router.post('/timecard/timecardId=:id&pos=:pos', isLoggedIn, notifications, testPost);


function checkDateIsPast(req, res, next){
	var today = new Date();
	var selectedDate = new Date(req.params.date)

	if(today < selectedDate){
		req.flash('error', 'Only past dates can be edited', false);
		return res.redirect('/timecard');
	} else {
		return next();
	}




}

router.get('/timecard/date=:date&day=:day&type=:type&pos=:pos', isLoggedIn, notifications, checkDateIsPast, function (req, res, next){
	res.render('timecardeditnonexist', {currentUser:req.user, notifications:req.notifications,  date:req.params.date, pos:req.params.pos, type:req.params.type, day:req.params.day});
});

function testPostNonExist(req, res, next){
	console.log('test post')
	var date = new Date(req.body.date)
	var month;
	var day;
	var minuteValue = parseInt(req.body.minutes)/60;
	console.log(minuteValue.toFixedDown(2));
	if(req.body.meridies == 'PM' && parseInt(req.body.hour) < 12){
		var hour = parseInt(req.body.hour) + 12;
	} else {
		var hour = parseInt(req.body.hour);
	}
	var totalValue = hour + minuteValue.toFixedDown(2);

	if(date.getMonth() < 10){
		month = '0'+(date.getMonth()+1);
	} else {
		month = date.getMonth() + 1;
	}

	if(date.getDate() < 10){
		day = '0'+ (date.getDate());
	} else {
		day = date.getDate();
	}

	var updatedDate = date.getFullYear()+'-'+month+'-'+day;

	if(req.user.ID == 1){
		sql.query(`INSERT INTO timecard`+req.user.ID+
						`(date, `+
						`type, `+
						`hour, `+
						`minutes, `+
						`day, `+
						`value) VALUES('`
						+updatedDate+`', '`
						+req.params.type+`', '`
						+hour+`', '`
						+req.body.minutes+`', '`
						+date.getDay()+`', '`
						+totalValue+`')`,
			function(err, result){
				if(err) throw err;
				req.flash('success', 'Clock edit success', false);
				res.redirect('/timecard');
			});
	} else {
		var todaysDate = new Date();
		var todaysMonth = todaysDate.getMonth() + 1;
		var todaysFullDate = todaysDate.getFullYear()+"-"+todaysMonth+"-"+todaysDate.getDate();
		sql.query(`INSERT INTO timeEditRequests (`
								+`user_id, `
								+`type, `
								+`clockDate, `
								+`clockType, `
								+`hour, `
								+`minutes, `
								+`day, `
								+`date, `
								+`comment, `
								+`pos, `
								+`value) VALUES ('`
								+req.user.ID+`', '`
								+`create', '`
								+updatedDate+`', '`
								+req.params.type+`', '`
								+hour+`', '`
								+req.body.minutes+`', '`
								+date.getDay()+`', '`
								+todaysFullDate+`', '`
								+validator.escape(req.body.comment)+`', '`
								+req.params.pos+`', '`
								+totalValue+`') `,
			function(err, result){
				if(err) throw err;
				req.flash('success', 'Clock edit request sent', false);
				res.redirect('/timecard');
			});
	}
}

router.post('/timecard/date=:date&day=:day&type=:type&pos=:pos', testPostNonExist);

function getAllUsers(req, res, next){
	sql.query("SELECT * FROM users", function(err, result){
		if(err) throw err;
		req.allUsers = result;
		return next();
	});
}

router.get('/timecardApprovals', isLoggedIn, isManager, notifications, getAllUsers, function(req, res, next){
	res.render('timecardApprovals', {currentUser:req.user, notifications:req.notifications, allUsers:req.allUsers});
});



router.post('/timecardApprovals/Decline/:id', isLoggedIn, isManager, function(req, res){
	sql.query("UPDATE timeEditRequests SET resolved = 'declined' WHERE ID = '"+req.params.id+"'", function(err, result){
		if(err) throw err;
		req.flash('warning', 'Successfully declined clock adjustment', false);
		return res.redirect('/timecardApprovals');
	});
});



router.post('/timecardApprovals/Approve/:id', isLoggedIn, isManager, function(req, res){
	sql.query("SELECT * FROM timeEditRequests WHERE ID = "+req.params.id, function(err, result){
		if(err) throw err;
		log = result[0];
		var date = new Date(log.clockDate)
		var adjustedMonth = date.getMonth() + 1;
		var adjustedDate = date.getFullYear()+"-"+adjustedMonth+"-"+date.getDate();
		if(log.type == 'create'){
			sql.query(`INSERT INTO timecard`+log.user_id+` (date, type, hour, minutes, day, value)`
						+`VALUES ('`+adjustedDate+`', '`+log.clockType+`', '`+log.hour+`', '`+log.minutes+`', '`+log.day+`', '`+log.value+`')`,
				function(err, result){
					if(err) throw err;
					sql.query("UPDATE timeEditRequests SET resolved = 'approved' WHERE ID = "+req.params.id, function(err, result){
						if(err) throw err;
						req.flash('success', 'Successfully Approved clock adjustment', false);
						return res.redirect('/timecardApprovals');
					});
				});
		} else if(log.type == 'edit'){
			console.log(`UPDATE timecard`+log.user_id+` SET date = '`+adjustedDate+`', hour = '`+log.hour+`', minutes = '`+log.minutes+`', day = '`+log.day+`', value = '`+log.value+`' WHERE ID = `+log.clockID);
			sql.query(`UPDATE timecard`+log.user_id+` SET date = '`+adjustedDate+`', hour = '`+log.hour+`', minutes = '`+log.minutes+`', day = '`+log.day+`', value = '`+log.value+`' WHERE ID = `+log.clockID, function(err, result){
				if(err) throw err;
				sql.query("UPDATE timeEditRequests SET resolved = 'approved' WHERE ID = "+req.params.id, function(err, result){
					if(err) throw err;
					req.flash('success', 'Successfully Approved clock adjustment', false);
					return res.redirect('/timecardApprovals');
				});
			});
		}
	});
});

function allClocksReport(req, res, next){
	console.log("all clocks report");

	var today = new Date();                           //get today
	var daysTillSatuday = 6 - today.getDay();         //figure out what day of the week it is
	var thisSaturday = today.addDays(daysTillSatuday); //get upcoming saturday of this week by taking 6 - today add that many days
	
	req.numberOfWeeks = 4

	sql.query("SELECT * FROM users WHERE NOT ID = 6", function(err, result){
		if(err) throw err;
		console.log("got all users")
		var usersDone = 0;
		req.allUsers = result;
		var usersArray = [];

		req.clockArray = []

		req.allUsers.forEach(function(user){
			for(var w=req.numberOfWeeks-1; w>-1; w--){
			var startNumber = 7 * w;
			var startDay = 27 - startNumber;


			for(var d=5; d>0; d--){
				var numDaysToSub = startDay - d;
				var workingDay = thisSaturday.subDays(numDaysToSub);
				var month = workingDay.getMonth() + 1;
				var queryDate = workingDay.getFullYear()+"-"+month+"-"+workingDay.getDate();


				let allClocks = new Promise((resolve, reject) => {
					resolve({week:w, day:d, queryDate:queryDate, date:workingDay});
				});

				allClocks.then(
					function(date){
						sql.query("SELECT * FROM timecard"+user.ID+" WHERE date = '"+date.queryDate+"'", function(err, result){
							if(err) reject(err);
							if(result.length > 0){
								req.clockArray.push({user:user.ID, week:date.week, date:date.date, day:date.day, clock1:result[0], clock2:result[1], clock3:result[2], clock4:result[3]});
								
								if(date.week == 0 && date.day == 1){
									usersDone++;
									if(usersDone == req.allUsers.length){
										//console.log(req.clockArray)
										return next();
									}
								}
							} else {
								req.clockArray.push({user:user.ID, week:date.week, date:date.date, day:date.day, clocks:[]});
								if(date.week == 0 && date.day == 1){
									usersDone++;
									if(usersDone == req.allUsers.length){
										//console.log(req.clockArray)
										return next();
									}
									
								}
							}



						});
					}
				).catch((reason) =>{
					console.log("REJECT "+reason);
				});
			}
		}
		});
	});

	//*****************************************************************************************************//

}

router.get('/timecardReport', isLoggedIn, isManager, notifications, allClocksReport, function(req, res, next){
	res.render('timecardReport', {currentUser:req.user, notifications:req.notifications,  clocks:req.clockArray, users:req.allUsers, weeks:req.numberOfWeeks});
});
//***************Authentication*********************//
function isLoggedIn(req, res, next){
  if(req.isAuthenticated()){
    return next();
  }else{
  res.redirect(`/`);
  }
}

function notifications(req, res, next){
	sql.query('SELECT * FROM timeEditRequests WHERE resolved = "false"', function(err, result){
		if(err) throw err;
		req.notifications = result;
		return next();
	});
}

function isManager(req, res, next){
	if(req.user.access == '1'){
		return next();
	} else {
		return req.flash('error', 'Access Denied');
	}
}

module.exports = router;