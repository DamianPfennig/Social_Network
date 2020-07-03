export function reducer(state = {}, action) {
    if (action.type == 'RECEIVE_FRIENDS_REQUESTS') {
        state = {
            ...state,
            friendsWannabes: action.friendsAndRequests
        }
        //console.log('state in reducer:: ', state);
        return state;
    }

    if (action.type == 'ACCEPT_FRIENDSHIP') {
        //console.log('state in reducer:::', state)
        state = {
            ...state,
            friendsWannabes: state.friendsWannabes.map(user => {
                if (user.id != action.id) {
                    return user;
                } else {
                    return {
                        ...user,
                        accepted: true
                    }

                }
            })
        }
        console.log('state in reducer:::', state)
        return state;
    }

    if (action.type == 'END_FRIENDSHIP') {
        state = {
            ...state,
            friendsWannabes: state.friendsWannabes.map(user => {
                if (user.id != action.id) {
                    return user;
                } else {
                    return {
                        ...user,
                        accepted: null
                    }
                }
            })
        }
    }
    return state;





}