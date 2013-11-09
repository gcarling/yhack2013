var fs = require("fs");
function formRedirect(html) {
    html = String(html);
    var regExp = ("<[ \n]*form");
    var htmlParseHelp  = html;
    var ind = 0;
    while(htmlParseHelp.search(regExp) != -1) {
	relInd = htmlParseHelp.search(regExp);
	console.log(relInd);
	ind += relInd;
	htmlParseHelp = html.substring(ind);
	html = replaceFormInfo(html, ind, htmlParseHelp);
	ind+=1;
	htmlParseHelp = html.substring(ind);
	console.log(ind);
	console.log(htmlParseHelp.substring(0, 50));
    }
    return html;
}
//htmlParseHelp should start at the index
//in html
function replaceFormInfo(html, index, htmlParseHelp) {
    return html.substring(0, index) +
	replaceFirstForm(htmlParseHelp);
}
//should start with a form
function replaceFirstForm(htmlParseHelp) {
    ind = htmlParseHelp.search("action *\=");
    if(ind == -1)
	return htmlParseHelp;
    
    ind1 = htmlParseHelp.substring(ind).search("\"");
    if(ind1 == -1)
	return htmlParseHelp;
    else
	ind1 += ind;
    
    ind2 = htmlParseHelp.substring(ind1+1).search("\"");
    if(ind2 == -1)
	return htmlParseHelp;
    else
	ind2 += ind1+1;

    htmlBeginning = htmlParseHelp.substring(0, ind1);
    
    action = htmlParseHelp.substring(ind1+1, ind2);
    tagInd = htmlParseHelp.substring(ind2).search(">");
    if(tagInd == -1)
	return htmlParseHelp;
    else
	tagInd += ind2;
    
    htmlAfterAction = htmlParseHelp.substring(ind2+1, tagInd+1);
    htmlRest = htmlParseHelp.substring(tagInd+1);
    hiddenElement = "<input type=\"hidden\" name=klnjkafsduiavho value=\"" + action + "\">";
    return htmlBeginning + "\"" + "/post/" + "\"" + htmlAfterAction + hiddenElement + htmlRest;
}
function test() {
    html = fs.readFileSync("sampleHtmlForms.html");
    fs.writeFileSync("formsOutput.html", formRedirect(html));
}
test();
