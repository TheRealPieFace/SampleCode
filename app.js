//********************MODULES******************//

var express       = require("express"),
    app           = express(),
    bodyParser    = require("body-parser"),
    passport      = require("passport"),
    LocalStrategy = require("passport-local"),
    session       = require("express-session"),
    User          = require("./models/user"),
    sql           = require("./models/sql"),
    mySqlStore    = require("express-mysql-session")(session),
    cookieParser  = require('cookie-parser');

//********************ROUTE VARIABLES******************//

var indexRoutes             = require("./routes/index"),
    auditRoutes             = require("./routes/audit"),
    orderRoutes             = require("./routes/orders"),
    inventoryRoutes         = require("./routes/inventory"),
    imagingRoutes           = require("./routes/imaging"),
    cleaningRoutes          = require("./routes/cleaning"),
    skinningRoutes          = require("./routes/skinning"),
    boxingRoutes            = require("./routes/boxing"),
    repairRoutes            = require("./routes/repair"),
    metricRoutes            = require("./routes/metrics"),
    deleteRoutes            = require("./routes/deleting"),
    editRoutes              = require("./routes/editing"),
    checkInventoryRoutes    = require("./routes/checkInventory"),
    returnRoutes            = require("./routes/returns"),
    accountingRoutes        = require("./routes/accounting"),
    shippingRoutes          = require("./routes/shipping"),
    customerServiceRoutes   = require("./routes/csr"),
    timecardRoutes          = require("./routes/timecard");

//********************APP CONFIG******************//

var sqlSettings      = require("./sqlSettings.json"),
    sessionSettings  = require("./sessionSettings.json");

var sessionStore = new mySqlStore(sqlSettings,);

app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");

//********************PASSPORT CONFIG******************//
User(passport);

app.use(session({
  secret: sessionSettings.secret,
  name: sessionSettings.name,
  resave: false,
  saveUninitialized: false,
  store: sessionStore
}));


app.use(passport.initialize());
app.use(passport.session());



//**************FLASH NOTIFICATION CONFIG****************//
app.use(require('express-flash-notification')(app, {
  viewName:    'flash',
  beforeSingleRender: function(notification, callback) {
    if (notification.type) {
      switch(notification.type) {
        case 'error':
          notification.alert_class = 'red message';
        break;
        case 'repair':
          notification.alert_class = 'orange message';
        break;
        case 'warning':
          notification.alert_class = 'yellow message';
        break;
        case 'info':
          notification.alert_class = 'blue message';
        break;
        case 'semi-success':
          notification.alert_class = 'olive message';
        break;
        case 'success':
          notification.alert_class = 'green message';
        break;
      }
    }
    callback(null, notification);
  },
}));

//==================================================//
//********************ROUTES************************//
//==================================================//

app.use(indexRoutes);
app.use(auditRoutes);
app.use(orderRoutes);
app.use(inventoryRoutes);
app.use(imagingRoutes);
app.use(cleaningRoutes);
app.use(skinningRoutes);
app.use(boxingRoutes);
app.use(repairRoutes);
app.use(shippingRoutes);
app.use(metricRoutes);
app.use(deleteRoutes);
app.use(editRoutes);
app.use(checkInventoryRoutes);
app.use(returnRoutes);
app.use(accountingRoutes);
app.use(timecardRoutes);
app.use(customerServiceRoutes);
  
app.use(express.static('public'))
app.use(express.static('uploads'))
app.use(express.static('node_modules'))

//****************** 404 PAGE ***************************//
app.get("*", notifications, function(req, res){
  res.status(404).render("404", {currentUser:req.user, notifications:req.notifications});
});

function notifications(req, res, next){
  sql.query('SELECT * FROM timeEditRequests WHERE resolved = "false"', function(err, result){
    if(err) throw err;
    req.notifications = result;
    return next();
  });
}

app.listen(port, ip, function(){
   console.log("ReGadget App is running..."); 
});
