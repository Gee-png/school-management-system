module.exports = {
    'username': (data)=>{
        if(data.trim().length < 3){
            return false;
        }
        return true;
    },
    'role': (data) => {
        return ['superadmin', 'school_admin'].includes(data);
    },
}