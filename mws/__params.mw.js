module.exports = ({ meta, config, managers }) =>{
    return ({req, res, next})=>{
        next(req.params, { id: req.params.id || null });
    }
}