"use strict";

/**
 * S-OSのワークエリアアドレス
 * 
 * 引用、参考
 * http://www43.tok2.com/home/cmpslv/Unk/SOS/S-OS%20Sword%20Ver2.0%20(J)(1986-02)(Oh!mz)%20[mz80K][type-in].txt
 */
class SOSWorkAddr {
	/**
	 * #USR(1F7EH-,2ﾊﾞｲﾄ)
	 * 
	 * CIOSをｺｰﾙﾄﾞｽﾀｰﾄしたあとｼﾞｬﾝﾌﾟするｱﾄﾞﾚｽを示している。  
	 * 通常はS-OSのﾎｯﾄｽﾀｰﾄのｱﾄﾞﾚｽになっている。
	 * @type {number}
	 */
	static USR = 0x1F7E;
	/**
	 * #DVSW(1F7DH,1ﾊﾞｲﾄ)
	 * 
	 * ﾃｰﾌﾟﾌｫｰﾏｯﾄなどを切り替えるﾌﾗｸﾞ。  
	 * 　　０：ＭＺﾌｫｰﾏｯﾄ2400ボー（共通モード）  
	 * 　　１：各機種のﾓﾆﾀに依存  
	 * 　　３：QD（ＭＺ－１５００のみ）  
	 * ｺｰﾙﾄﾞｽﾀｰﾄ時は０になっている。
	 * @type {number}
	 */
	static DVSW = 0x1F7D;
	/**
	 * #LPSW(1F7CH,1ﾊﾞｲﾄ)
	 * 
	 * #PRINT～#TAB、#PRTHX、#PRTHLﾙｰﾁﾝでの出力をﾃﾞｨｽﾌﾟﾚｲだけでなくﾌﾟﾘﾝﾀにも出力するかどうかのﾌﾗｸﾞ。  
	 * ０以外でﾌﾟﾘﾝﾀにも出力。ｺｰﾙﾄﾞｽﾀｰﾄ時は０になっている。
	 */
	static LPSW = 0x1F7C;
	/**
	 * #PRCNT(1F7AH-,2ﾊﾞｲﾄ)
	 * 
	 * 改行してから表示した文字数を格納してあるｱﾄﾞﾚｽを示している。
	 * @type {number}
	 */
	static PRCNT = 0x1F7A;
	/**
	 * #XYADR(1F78H-,2ﾊﾞｲﾄ)
	 * 
	 * ｶｰｿﾙ座標が格納されているｱﾄﾞﾚｽを示している。
	 * @type {number}
	 */
	static XYADR = 0x1F78;
	/**
	 * #KBFAD(1F76H-,2ﾊﾞｲﾄ)
	 * 
	 * 各機種のｷｰ入力用ﾊﾞｯﾌｧのｱﾄﾞﾚｽを示している。  
	 * 例）LD      DE,(#KBFAD)  
	 *     CALL    #GETL
	 * @type {number}
	 */
	static KBFAD = 0x1F76;
	/**
	 * #IBFAD(1F74H-,2ﾊﾞｲﾄ)
	 * 
	 * ｲﾝﾌｫﾒｰｼｮﾝﾌﾞﾛｯｸの先頭ｱﾄﾞﾚｽを示している。  
	 * 同時にﾌｧｲﾙｱﾄﾘﾋﾞｭｰﾄのｱﾄﾞﾚｽでもある。
	 * @type {number}
	 */
	static IBFAD = 0x1F74;
	/**
	 * #SIZE(1F72H-,2ﾊﾞｲﾄ)
	 * 
	 * ﾌｧｲﾙｻｲｽﾞ。  
	 * #WOPEN、#WRD、#FCB、#RDD、#ROPENﾙｰﾁﾝで使用される。
	 */
	static SIZE = 0x1F72;
	/**
	 * #DTADR(1F70H-,2ﾊﾞｲﾄ)
	 * 
	 * ﾌｧｲﾙ先頭ｱﾄﾞﾚｽ。
	 * @type {number}
	 */
	static DTADR = 0x1F70;
	/**
	 * #EXADR(1F6EH-,2ﾊﾞｲﾄ)
	 * 
	 * ﾌｧｲﾙのｴﾝﾄﾘｱﾄﾞﾚｽ。
	 * @type {number}
	 */
	static EXADR = 0x1F6E;
	/**
	 * #STKAD(1F6CH-,2ﾊﾞｲﾄ)
	 * 
	 * 各機種のﾓﾆﾀが使用しているｽﾀｯｸのｱﾄﾞﾚｽを示している。
	 * @type {number}
	 */
	static STKAD = 0x1F6C;
	/**
	 * #MEMAX(1F6AH-,2ﾊﾞｲﾄ)
	 * 
	 * S-OSで使用できるﾒﾓﾘの上限を表す。
	 * @type {number}
	 */
	static MEMAX = 0x1F6A;
	/**
	 * #WKSIZ※(1F68H-,2ﾊﾞｲﾄ)
	 * 
	 * 特殊ﾜｰｸｴﾘｱのｻｲｽﾞを表す。
	 * @type {number}
	 */
	static WKSIZ = 0x1F68;
	/**
	 * #DIRNO※(1F67H,1ﾊﾞｲﾄ)
	 * 
	 * #FCBで使用するﾜｰｸ。このﾜｰｸに値を入れて#FCBをｺｰﾙすると、先頭から数えてその値で示されるFCBを(#IBFAD)にﾛｰﾄﾞする。  
	 * ﾛｰﾄﾞ後、値は１増える。
	 * @type {number}
	 */
	static DIRNO = 0x1F67;
	/**
	 * #MXTRK※(1F66H,1ﾊﾞｲﾄ)
	 * 
	 * 使用できる最大ﾄﾗｯｸ数が入っている。
	 * @type {number}
	 */
	static MXTRK = 0x1F66;
	/**
	 * #DTBUF※(1F64H-,2ﾊﾞｲﾄ)
	 * 
	 * ﾃﾞｨｽｸからﾃﾞｰﾀを読み込む先頭ｱﾄﾞﾚｽが入っているﾃﾞｰﾀﾊﾞｯﾌｧは256ﾊﾞｲﾄ。
	 * @type {number}
	 */
	static DTBUF = 0x1F64;
	/**
	 * #FATBF※(1F62H-,2ﾊﾞｲﾄ)
	 * 
	 * ﾃﾞｨｽｸからFATを読み込む先頭ｱﾄﾞﾚｽが入っている。  
	 * FATﾊﾞｯﾌｧは256ﾊﾞｲﾄ。
	 * @type {number}
	 */
	static FATBF = 0x1F62;
	/**
	 * #DIRPS※(1F60H-,2ﾊﾞｲﾄ)
	 * ﾃﾞｨﾚｸﾄﾘが入っているﾚｺｰﾄﾞﾅﾝﾊﾞｰの始まりを示す。  
	 * S-OS"SWORD"では10Ｈ、書き換えることによってﾃﾞｨﾚｸﾄﾘの位置を移動できる。
	 * @type {number}
	 */
	static DIRPS = 0x1F60;
	/**
	 * #FATPOS※(1F5EH-,2ﾊﾞｲﾄ)
	 * 
	 * ﾌｧｲﾙｱﾛｹｰｼｮﾝﾃｰﾌﾞﾙ（FAT）が入っているﾚｺｰﾄﾞﾅﾝﾊﾞｰを示す。  
	 * S-OS"SWORD"では0EＨ。  
	 * 書き換えることによりFATの位置を移動することができる。
	 * @type {number}
	 */
	static FATPOS = 0x1F5E;
	/**
	 * #DSK※(1F5DH,1ﾊﾞｲﾄ)
	 * 
	 * ｱｸｾｽしようとするﾃﾞﾊﾞｲｽ名が入る。
	 * @type {number}
	 */
	static DSK = 0x1F5D;
	/**
	 * #WIDTH※(1F5CH,1ﾊﾞｲﾄ)
	 * 
	 * 現在のｼｸﾘｰﾝﾓｰﾄﾞが入っている。  
	 * 40ｷｬﾗの場合：28Ｈ  
	 * 80ｷｬﾗの場合：50Ｈ  
	 * 80K/C/1200/700/1500は横40ｷｬﾗ固定。
	 * @type {number}
	 */
	static WIDTH = 0x1F5C;
	/**
	 * #MAXLIN※(1F5BH,1ﾊﾞｲﾄ)
	 * 
	 * 画面に表示できる最大行数が入っている。
	 */
	static MAXLIN = 0x1F5B;

	/**
	 * #ETRK(20FFH,1ﾊﾞｲﾄ)
	 * 
	 * Eドライブの未フォーマット時のクラスタ数
	 */
	static ETRK = 0x20FF;
};
