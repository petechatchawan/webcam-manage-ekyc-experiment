export enum ProcessingState {
  NOT_PROCESS = 'NOT-PROCESS',
  IN_PROCESS = 'IN-PROCESS',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT',
  CANCEL = 'CANCEL',
  BACK = 'BACK',
  CONFIRM = 'CONFIRM',

  // For ADDITIONAL DETAILS
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  PROCESSED = 'PROCESSED',

  // For OCR
  INVALID_FORMAT = 'INVALID-FORMAT',
  INVALID_SIZE = 'INVALID-SIZE',
  TEXT_NOT_ENOUGH = 'TEXT-NOT-ENOUGH',
  TEXT_NOT_FOUND = 'TEXT-NOT-FOUND',
  WORD_NOT_ENOUGH = 'WORD-NOT-ENOUGH',
}

export enum IdCardState {
  NotFound = 'not-found-card',
  TooFar = 'card-too-far',
  Correct = 'card-correct',
  TooClose = 'card-too-close',
}
