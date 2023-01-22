export default class {
    navigator;
    axis = [];
    buttons = [];

    // standardタイプのコントローラのマッピング
    //
    // https://sbfl.net/blog/2016/05/11/gamepad-api-on-browsers/
    // より
    BUTTON_A_INDEX     = 0;
    BUTTON_B_INDEX     = 1;
    BUTTON_X_INDEX     = 2;
    BUTTON_Y_INDEX     = 3;
    BUTTON_LB_INDEX    = 4;
    BUTTON_RB_INDEX    = 5;
    BUTTON_LT_INDEX    = 6;
    BUTTON_RT_INDEX    = 7;
    BUTTON_BACK_INDEX  = 8;
    BUTTON_START_INDEX = 9;
    BUTTON_L3_INDEX    = 10;
    BUTTON_R3_INDEX    = 11;
    BUTTON_UP_INDEX    = 12;
    BUTTON_DOWN_INDEX  = 13;
    BUTTON_LEFT_INDEX  = 14;
    BUTTON_RIGHT_INDEX = 15;
    BUTTON_HOME_INDEX  = 16;

    constructor(navigator) {
        this.axis = [
            {x:0, y:0},
            {x:0, y:0}
        ];
        this.buttons = [
            { current: false, previous: false, trigger: false, pressed: false, released: false },
            { current: false, previous: false, trigger: false, pressed: false, released: false },
            { current: false, previous: false, trigger: false, pressed: false, released: false },
            { current: false, previous: false, trigger: false, pressed: false, released: false },
            { current: false, previous: false, trigger: false, pressed: false, released: false },
            { current: false, previous: false, trigger: false, pressed: false, released: false },
            { current: false, previous: false, trigger: false, pressed: false, released: false },
            { current: false, previous: false, trigger: false, pressed: false, released: false },
            { current: false, previous: false, trigger: false, pressed: false, released: false },
            { current: false, previous: false, trigger: false, pressed: false, released: false },
            { current: false, previous: false, trigger: false, pressed: false, released: false },
            { current: false, previous: false, trigger: false, pressed: false, released: false },
            { current: false, previous: false, trigger: false, pressed: false, released: false },
            { current: false, previous: false, trigger: false, pressed: false, released: false },
            { current: false, previous: false, trigger: false, pressed: false, released: false },
            { current: false, previous: false, trigger: false, pressed: false, released: false },
            { current: false, previous: false, trigger: false, pressed: false, released: false }
        ];
        this.navigator = navigator;
    }

    /**
     * 更新処理
     */
    update() {
        // getGamepads メソッドに対応している
        if(this.navigator.getGamepads){
            // ------------------------------------------------------------
            // ゲームパッドリストを取得する
            // ------------------------------------------------------------
            const gamepad_list = this.navigator.getGamepads();

            // ------------------------------------------------------------
            // アイテム総数を取得する
            // ------------------------------------------------------------
            const num = gamepad_list.length;

            // ------------------------------------------------------------
            // ゲームパッドを順番に取得する
            // ------------------------------------------------------------
            for(let i = 0; i < num; i++) {
                // ゲームパッドを取得する（undefined 値の場合もある）
                var gamepad = gamepad_list[i];

                // 出力テスト
                if(gamepad && gamepad.connected) {
                    const BOUND_LOW  = 0.05;
                    const BOUND_HIGH = 0.95;

                    var rawX = gamepad.axes[0];
                    var rawY = gamepad.axes[1];

                    var magX = (rawX < 0) ? -rawX : rawX;
                    var magY = (rawY < 0) ? -rawY : rawY;
                    var x = (magX - BOUND_LOW) / (BOUND_HIGH - BOUND_LOW);
                    var y = (magY - BOUND_LOW) / (BOUND_HIGH - BOUND_LOW);
                    if(x < 0.0) {
                        x = 0.0;
                    } else if(x >= 1.0) {
                        x = (rawX < 0) ? -1.0 : 1.0;
                    } else {
                        x = (rawX < 0) ? -x : x;
                    }
                    if(y < 0.0) {
                        y = 0.0;
                    } else if(y >= 1.0) {
                        y = (rawY < 0) ? -1.0 : 1.0;
                    } else {
                        y = (rawY < 0) ? -y : y;
                    }
                    this.axis[0].x = x;
                    this.axis[0].y = y;

                    rawX = gamepad.axes[2];
                    rawY = gamepad.axes[3];

                    magX = (rawX < 0) ? -rawX : rawX;
                    magY = (rawY < 0) ? -rawY : rawY;
                    x = (magX - BOUND_LOW) / (BOUND_HIGH - BOUND_LOW);
                    y = (magY - BOUND_LOW) / (BOUND_HIGH - BOUND_LOW);
                    if(x < 0.0) {
                        x = 0.0;
                    } else if(x >= 1.0) {
                        x = (rawX < 0) ? -1.0 : 1.0;
                    } else {
                        x = (rawX < 0) ? -x : x;
                    }
                    if(y < 0.0) {
                        y = 0.0;
                    } else if(y >= 1.0) {
                        y = (rawY < 0) ? -1.0 : 1.0;
                    } else {
                        y = (rawY < 0) ? -y : y;
                    }
                    this.axis[1].x = x;
                    this.axis[1].y = y;

                    // ボタン
                    for(let index = 0; index < 17; ++index) {
                        const current = (gamepad.buttons[index].value > 0 || gamepad.buttons[index].pressed == true);
                        this.buttons[index].previous = this.buttons[index].current;
                        this.buttons[index].current = current;
                        this.buttons[index].trigger = this.buttons[index].previous ^ current;
                        this.buttons[index].pressed = this.buttons[index].trigger && current;
                        this.buttons[index].released = this.buttons[index].trigger && !current;
                    }
                    break;
                } else {
                    this.axis[0].x = 0.0;
                    this.axis[0].y = 0.0;
                    this.axis[1].x = 0.0;
                    this.axis[1].y = 0.0;
                }
            }
        }
    }
};
