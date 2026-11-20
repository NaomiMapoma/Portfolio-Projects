// Input limits shared by the server and the browser (no server-only imports here).

export const MAX_CV_CHARS = 15_000;
export const MAX_JD_CHARS = 10_000;
/** Longest optional writing sample used for the cover letter's tone. */
export const MAX_SAMPLE_CHARS = 2_000;
/** Largest JSON request body any API route will read (bigger is rejected before parsing). */
export const MAX_BODY_BYTES = 200_000;
/** Largest upload body for /api/parse-cv: the 5MB file limit plus form overhead. */
export const MAX_UPLOAD_BODY_BYTES = 6 * 1024 * 1024;
/** Longest optional notes box (extra background that is not on the CV). */
export const MAX_NOTES_CHARS = 3_000;
/** Longest answer to one clarifying question that is sent on to the draft or the letter. */
export const MAX_ANSWER_CHARS = 1_000;
