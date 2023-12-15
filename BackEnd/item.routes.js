const express = require('express');
const itemRoutes = express.Router();

let Item = require("./item.model.js")

const {getAll} = require('./item.controller.js')

itemRoutes.route('/create').post(function (req, res) {
    let item = new Item(req.body);
    item.save()
        .then(item => {
            res.status(200).json({'item': 'item in added successfully'});
        })
        .catch(err => {
            res.status(400).send("unable to save to database");
        });
});

itemRoutes.route('/update/:id').put(function(req,res){
    const id = req.params.id;
    const update = req.body;
    Item.updateOne({ _id:id }, { $set:update })
    .exec()
    .then(() => {
      res.status(200).json({
        success: true,
        message: 'Item Update state',
        updateItem: updateObject,
      });
    })
    .catch((err) => {
      res.status(500).json({
        success: false,
        message: 'Server error. Please try again.'
      });
    });
})


itemRoutes.route("/").get(getAll);

module.exports = itemRoutes;