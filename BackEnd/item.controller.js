const item_service = require("./item.service")

exports.getAll = async (req, res) => {
    try {
      const items = await item_service.getAll();
      res.json({ data: items, status: "success" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

exports.getByName = async(req, res) => {
  try{
    const item = await item_service.getByName(req.body.name);
    res.json({ data: item, status: "success" });
  }catch(err){
    res.status(500).json({ error: err.message });
  }
}