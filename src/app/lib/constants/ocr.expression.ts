export const THAI_ID_REGEX = {
  WORDS_ENG: new RegExp(
    /(Thai|National|ID|Card|Identification|Number|N[e|a]me|Last[ |]n[e|a]me|Expiry|Issue|D(\w+|)[ ](\w+|)f[ ][B|h](\w+|)[ ](\d{1,2}[ |])([[J|j]an[.| |]|[F|f]eb[.| |]|[M|m]ar[.| |]|[A|a]pr[.| |]|[M|m]ay[.| |]|[J|j]un[.| |]|[J|j]ul[.| |]|[A|a]ug[.| |]|[S|s]ep[.| |]|[O|o]ct[.| |]|[N|n]ov[.| |]|[D|d]ec[.| |]])[ |][1|2]\d{3})/g,
  ),
  WORDS_THAI: new RegExp(
    /(บัตรประจำตัวประชาชน|ประชาชน|นาย|นาง|และ|ศาสนา|วันบัตร|ออกบัตร|หมดอายุ|Mr.|Thai|N[e|a]tional|ID|Card|Identification|Number|N[e|a]me|Last[ |]n[e|a]me|Ex[p|g|q]iry|Issue|(เกิดวันที่ \d{1,2} [ก-ฮ].[ก-ฮ]. 2[4|5]\d{2})|(แขวง)|(เขต)|(ที่อยู่)|D(\w+|)[ ](\w+|)f[ ][B|h](\w+|)[ ](\d{1,2}[ |])([[J|j]an[.| |]|[F|f]eb[.| |]|[M|m]ar[.| |]|[A|a]pr[.| |]|[M|m]ay[.| |]|[J|j]un[.| |]|[J|j]ul[.| |]|[A|a]ug[.| |]|[S|s]ep[.| |]|[O|o]ct[.| |]|[N|n]ov[.| |]|[D|d]ec[.| |]])[ |][1|2]\d{3}|([0-9][ -]\d{4}[ -]\d{5}[ -]\d{2}[ -]\d)|(\d{4}[ -]\d{2}[ -]\d{8}))/g,
  ),
  DIGIT: new RegExp(/[1-8]\d{12}/g),
  DIGIT_SIGN: new RegExp(/[1-8][ -]\d{4}[ -]\d{5}[ -]\d{2}[ -]\d/g),
  DIGIT_BACK_CARD: new RegExp(/[A-Z]{2}[O|o|0-9]\d{9}/g),
  THAI_ID: new RegExp(/(\d{1}( |)\d{4}( |)\d{5}( |)\d{2}( |)\d{1})/g),
};

export const THAI_ID_MLKIT_FRONT_REGEX = {
  WORDS: new RegExp(
    /(Thai|National|ID|Card|Identification|Number|N[e|a]me|Last[ |]n[e|a]me|Expiry|Issue|D(\w+|)[ ](\w+|)f[ ][B|h](\w+|)[ ](\d{1,2}[ |])([[J|j]an[.| |]|[F|f]eb[.| |]|[M|m]ar[.| |]|[A|a]pr[.| |]|[M|m]ay[.| |]|[J|j]un[.| |]|[J|j]ul[.| |]|[A|a]ug[.| |]|[S|s]ep[.| |]|[O|o]ct[.| |]|[N|n]ov[.| |]|[D|d]ec[.| |]])[ |][1|2]\d{3})/g,
  ),
  DIGIT: new RegExp(/[1-8]\d{12}/g),
  DIGIT_SIGN: new RegExp(/[1-8][ -]\d{4}[ -]\d{5}[ -]\d{2}[ -]\d/g),
  DIGIT_BACK_CARD: new RegExp(/[A-Z]{2}[O|o|0-9]\d{9}/g),
  THAI_ID: new RegExp(/(\d{1}( |)\d{4}( |)\d{5}( |)\d{2}( |)\d{1})/g),
};

export const THAI_ID_APPLE_FRONT_REGEX = {
  WORDS: new RegExp(
    /(บัตรประจำตัวประชาชน|ประชาชน|นาย|นาง|และ|ศาสนา|วันบัตร|ออกบัตร|หมดอายุ|Mr.|Thai|N[e|a]tional|ID|Card|Identification|Number|N[e|a]me|Last[ |]n[e|a]me|Ex[p|g|q]iry|Issue|(เกิดวันที่ \d{1,2} [ก-ฮ].[ก-ฮ]. 2[4|5]\d{2})|(แขวง)|(เขต)|(ที่อยู่)|D(\w+|)[ ](\w+|)f[ ][B|h](\w+|)[ ](\d{1,2}[ |])([[J|j]an[.| |]|[F|f]eb[.| |]|[M|m]ar[.| |]|[A|a]pr[.| |]|[M|m]ay[.| |]|[J|j]un[.| |]|[J|j]ul[.| |]|[A|a]ug[.| |]|[S|s]ep[.| |]|[O|o]ct[.| |]|[N|n]ov[.| |]|[D|d]ec[.| |]])[ |][1|2]\d{3}|([0-9][ -]\d{4}[ -]\d{5}[ -]\d{2}[ -]\d)|(\d{4}[ -]\d{2}[ -]\d{8}))/g,
  ),
  DIGIT: new RegExp(/[1-8]\d{12}/g),
  DIGIT_SIGN: new RegExp(/[1-8][ -]\d{4}[ -]\d{5}[ -]\d{2}[ -]\d/g),
  DIGIT_BACK_CARD: new RegExp(/[A-Z]{2}[O|o|0-9]\d{9}/g),
  THAI_ID: new RegExp(/(\d{1}( |)\d{4}( |)\d{5}( |)\d{2}( |)\d{1})/g),
};

export const PASSPORT_CARD_REGEX = {
  Date: new RegExp(
    /(([3][0-1])|([1-2][0-9])|([0][0-9]))\s(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s([1-2]\d{3})/,
  ),
  MRZ1: new RegExp(/([P][<A-Z0-9]{1})([A-Z]{3})(([A-Z]*<){2})(([A-Z]*<|[A-Z]*){3})(<*)/),
  MRZ2: new RegExp(
    /([A-Z0-9<]{9})([0-9])([A-Z<]{3})([0-9]{6})([0-9])([MNF<])([0-9]{6})([0-9])([A-Z0-9<]{14})([0-9<])([0-9])/,
  ),
};

/**
 * Github
 * https://gist.github.com/peatiscoding/a16840caed0ba1b29e6b2fe171565ea0#file-assertthaiid-ts
 */

export const assertThaiId = (thaiId: string): boolean => {
  const m = thaiId.match(/(\d{12})(\d)/);
  if (!m) {
    // console.warn('Bad input from user, invalid thaiId=', thaiId);
    return false;
  }
  const digits = m[1].split('');
  const sum = digits.reduce((total: number, digit: string, i: number) => {
    return total + (13 - i) * +digit;
  }, 0);

  const lastDigit = `${(11 - (sum % 11)) % 10}`;
  const inputLastDigit = m[2];
  if (lastDigit !== inputLastDigit) {
    // console.warn('Bad input from user, invalid checksum thaiId=', thaiId);
    return false;
  }
  return true;
};
