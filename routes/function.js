import axios from 'axios'
let openids = ['otUibwDjOGCQLfEIrKGk43uDWKSo','otUibwN_3e3yG3WMsHvNyH3X2jbo']
export function push(openids) {
  getAccessToken()
    .then(function (res) {
      console.log(openids)
      let token = res.data.access_token
      return Promise.all(openids.map(function(openid){
        return sendTemplateMessage(token, openid)
      }))
    })
    .then(function (res) {
      console.log(res)
    })
    .catch(function (err) {
      console.log(err)
    })
}

function getAccessToken() {
  let grant_type = 'client_credential'
  let appid = 'wxb837da69673a3248'
  let secret = 'd2f529630438b8c909634dcb163001bc'
  let url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=${grant_type}&appid=${appid}&secret=${secret}`
  return axios.get(url)
}

function sendTemplateMessage(token, openid) {
  let url = `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`
  let data = {
    "touser": openid,
    "template_id": "SXnGjGy37-8oRG0H336Sy_xCVV6LYxeN7FLZX2JkJrs",
    "url": "",
    "topcolor": "#FF0000",
    "data": {
      "remark": {
        "value": "有一场比赛结束了，赶紧去匹配吧",
        "color": "#000000"
      }
    }
  }
  return axios.post(url, JSON.stringify(data))
}