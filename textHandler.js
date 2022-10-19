
let textHandler = {}
module.exports = textHandler;
//使用说明：别动已经存在的函数，每个函数参数最多5个，都是string，第一个参数必须是源文本，必须返回处理后的字符串。
//可以声明textHandler的变量成员，注意别重名就行

/**
 * 正则替换
 *
 * @param {*} regexp 正则表达式
 * @param {*} replace 替换内容
 */
textHandler.正则替换 = function (text, regexp, replace) {
    // console.log("执行正则替换" + regexp + "  " + replace);
    return text.replaceAll(regexp, replace);
}

/**
 * 单字重复处理
 *
 * @param {*} text
 * @param {*} repeatTime 单重复的次数
 * @return {*} 
 */
textHandler.单字重复 = function (text, repeatTime) {
    let result = "";
    for (let i = 0; i < text.length; i++) {
        const char = text.charAt(i);
        if (char) {
            result.concat(char);
        }
        i += repeatTime;
    }
    return result;
}
/**
 * 限制最大字数，超出则返回空字符串
 *
 * @param {*} text
 * @param {*} maxText
 */
textHandler.字数限制 = function (text, maxLength) {
    return text.length <= maxLength ? text : "";
}

/**
 * 消除换行，其实就是个正则替换
 *
 * @param {string} text
 */
textHandler.消除换行 = function (text) {
    return text.replace(/\n|\r/gi, "");
}
