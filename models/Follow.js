const { ObjectID } = require('mongodb');
const usersCollection = require('../db').db().collection('users');
const followsCollection = require('../db').db().collection('follows');
const User = require('./User');

let Follow = function(followedUsername, authorId){
    this.followedUsername = followedUsername;
    this.authorId = authorId;
    this.errors = [];
};

Follow.prototype.cleanUp = function(){
    if(typeof(this.followedUsername) != 'string'){
        this.followedUsername = '';
    }
};

Follow.prototype.validate = async function(action){
    let followedAccount = await usersCollection.findOne({username: this.followedUsername});
    if(followedAccount){
        this.followId = followedAccount._id;
    }else{
        this.errors.push('You cannot follow a user that does not exist.');
    }

    let doesFollowAlreadyExists = await followsCollection.findOne({followId: this.followId, authorId: new ObjectID(this.authorId)});
    if(action == 'create'){
        if(doesFollowAlreadyExists){
            this.errors.push('You are already following this user.');
        }
    }

    if(action == 'delete'){
        if(!doesFollowAlreadyExists){
            this.errors.push('You cannot stop following someone you do not already follow.');
        }
    }

    if(this.followId.equals(this.authorId)){
        this.errors.push('You cannot follow yourself.');
    }
};

Follow.prototype.create = function(){
    return new Promise(async (resolve, reject) => {
        this.cleanUp();
        await this.validate('create');
        if(!this.errors.length){
            await followsCollection.insertOne({
                followId: this.followId,
                authorId: new ObjectID(this.authorId)
            });
            resolve();
        }else{
            reject(this.errors);
        }
    });
};

Follow.prototype.delete = function(){
    return new Promise(async (resolve, reject) => {
        this.cleanUp();
        await this.validate('delete');
        if(!this.errors.length){
            await followsCollection.deleteOne({
                followId: this.followId,
                authorId: new ObjectID(this.authorId)
            });
            resolve();
        }else{
            reject(this.errors);
        }
    });
};

Follow.isVisitorFollowing = async function(followId, visitorId){
    let followDoc = await followsCollection.findOne({followId: followId, authorId: new ObjectID(visitorId)});
    if(followDoc){
        return true;
    }else{
        return false;
    }
};

Follow.getFollowersById = function(id){
    return new Promise(async (resolve, reject) => {
        try{
            let followers = await followsCollection.aggregate([{
                $match: {followId: id}
            },
            {
                $lookup: {from:'users', localField: 'authorId', foreignField:'_id', as:'userDoc'}
            },
            {
                $project: {
                    username: {$arrayElemAt: ['$userDoc.username', 0]},
                    email: {$arrayElemAt: ['$userDoc.email', 0]}
            }
            }
        ]).toArray();
        followers = followers.map(follower => {
            let user = new User(follower, true);
            return {
                username: follower.username,
                avatar: user.avatar
            };
        });
        resolve(followers);
        }catch{
            reject();
        }
    });
}

Follow.getFollowingById = function(id){
    return new Promise(async (resolve, reject) => {
        try{
            let followers = await followsCollection.aggregate([{
                    $match: {authorId: id}
                },
                {
                    $lookup: {from:'users', localField: 'followId', foreignField:'_id', as:'userDoc'}
                },
                {
                    $project: {
                        username: {$arrayElemAt: ['$userDoc.username', 0]},
                        email: {$arrayElemAt: ['$userDoc.email', 0]}
                }
                }
            ]).toArray();
            followers = followers.map(follower => {
                let user = new User(follower, true);
                return {
                    username: follower.username,
                    avatar: user.avatar
                };
            });
            resolve(followers);
        }catch{
            reject();
        }
    });
};

Follow.countFollowersById = function(id){
    return new Promise(async (resolve, reject) => {
        let followerCount = await followsCollection.countDocuments({followId: id});
        resolve(followerCount);
    });
};

Follow.countFollowingById = function(id){
    return new Promise(async (resolve, reject) => {
        let count = await followsCollection.countDocuments({authorId: id});
        resolve(count);
    });
};

module.exports = Follow;