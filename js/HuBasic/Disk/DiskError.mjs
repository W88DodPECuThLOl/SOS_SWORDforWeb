export class DiskError extends Error {
    #errorCode;

    constructor(errorCode) {
        super();
        this.errorCode = errorCode;
    }
}

export const DiskErrorCode = {
    /**
     * 不明なイメージタイプ
     */
    UnknownDiskImageType : 1,
};
