import {Cut, CutBorder, mouseOverInnerMost} from './cut.js';
import {getDeviceRatio, displayError} from './renderer.js';
import {doubleCut, insertion} from './logic/rules.js';
import {toggleMiniRenderer} from './minirenderer.js';
import {CanvasManager} from './canvasManager.js';
import {transformPoint} from './lib/math.js';
import {CutManager} from './cutmanager.js';
import {Subgraph} from './subgraph.js';
import {clearCanvas} from './main.js';
import {Point} from './lib/point.js';
import {Symbolic} from './symbol.js';

var UserInputManager = (function(){
    var instance = null;

    function createInstance() {
        return new __USER_INPUT_MANAGER();
    }
 
    return {
        /** @returns {__USER_INPUT_MANAGER} */
        getInstance: function () {
            if (!instance) {
                instance = createInstance();
            }
            return instance;
        }
    };
})();


/** Manages the user input state */
class __USER_INPUT_MANAGER{
    constructor(){
        let CM = CanvasManager.getInstance();
        let MINI_CANVAS = CM.MiniCanvas;

        CM.Canvas.addEventListener('mousedown', onMouseDown);
        CM.Canvas.addEventListener('mouseup', onMouseUp);
        CM.Canvas.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        MINI_CANVAS.addEventListener('mousedown', onMouseDown);
        MINI_CANVAS.addEventListener('mouseup', onMouseUp);
        MINI_CANVAS.addEventListener('mousemove', this.onMouseMove);

        this.is_dragging = false;
        this.is_mouse_down = false;
        this.is_shift_down = false;
        this.is_ctrl_down = false;
        this.mouse_pos = new Point(0,0);
        this.last_mouse_pos = this.mouse_pos;
        this.is_proof_mode = false;

        this.current_obj = null;
        this.obj_under_mouse = false;
        this.is_options_menu_open = false;

        document.getElementById('toggle_mode').addEventListener('click', toggleMode);
        document.getElementById('insert-btn').addEventListener('click', toggleMiniRenderer);
        document.getElementById('exit-mini').addEventListener('click', toggleMiniRenderer);
        document.getElementById('dbl-cut-btn').addEventListener('click', () => {
            doubleCut( new Subgraph(CM.proof_selected) );
            toggleDoubleCutButton();
        });
        document.getElementById('insert-graph').addEventListener('click', () => {
            toggleMiniRenderer();
            insertion( new Subgraph( CM.s_cuts.concat(CM.s_syms) ) );
        });
        document.getElementById('iteration-btn').addEventListener('click', () => { displayError('not implemented'); });
        document.getElementById('deiteration-btn').addEventListener('click', () => { displayError('not implemented'); });
        document.getElementById('close-btn').addEventListener('click', toggleOptions);
        document.getElementById('options-btn').addEventListener('click', toggleOptions);
        document.getElementById('clear-btn').addEventListener('click', clearCanvas);
        
        toggleProofButtons();
        toggleOptions();
    }

    clearData(){
        this.current_obj = null;
        this.obj_under_mouse = false;
        toggleOptions();
    }

    update(){
        this.updateUserInput();
    }


    updateUserInput(){
        this.is_dragging = this.is_mouse_down && this.is_moving;
        this.is_moving = false;

        if (!this.is_proof_mode){
            if ( this.is_dragging && !(this.current_obj === null) ){
                this.current_obj.updatePos( UserInputManager.getInstance().mouse_pos );
            }
        }

        if ( this.current_obj === null ){
            document.getElementById('canvas').style.cursor = 'default'; 
        }
    }

    /** @param {MouseEvent} e */
    onMouseMove(e){
        e.preventDefault();
        e.stopPropagation();

        let UM = UserInputManager.getInstance();
        UM.mouse_pos = getRealMousePos(e);
        UM.is_moving = true;

        //TODO find a better a time to figure this out
        CutManager.getInstance().recalculate();
    }
}

/** @param {MouseEvent} e */
function onMouseDown(e){
    let CM = CanvasManager.getInstance();
    let UM = UserInputManager.getInstance();
    UM.last_mouse_pos = getRealMousePos(e);
    UM.is_mouse_down = true;


    if ( UM.is_shift_down && !UM.is_proof_mode ){
        return;
    }


    function isOverAnything(tgt_list){
        for(let x of tgt_list){
            
            if((x instanceof Cut) && (x.is_mouse_in_border || mouseOverInnerMost(x).is_mouse_in_border) ){
                UM.current_obj = x.cut_border;
                return;
            }

            if(x instanceof CutBorder){
                UM.current_obj = x;
                return;
            }

            if(x.is_mouse_over){
                UM.current_obj = (x instanceof Cut) ? mouseOverInnerMost(x) : x;
            }
        }


    }


    if(CM.is_mini_open){
        isOverAnything(CM.s_cuts);
        isOverAnything(CM.s_syms);
    }else{
        isOverAnything(CM.cuts);
        isOverAnything(CM.syms);
    }


    //if CTRL + SHIFT select whatever gets clicked and all its children as 
    //proof selected
    if(UM.is_shift_down && UM.is_ctrl_down && UM.current_obj !== null){
        for(let x of CM.getAllObjects(UM.current_obj)){
            x.is_proof_selected = !x.is_proof_selected;
            if(x.is_proof_selected){
                CM.addProofSelected(x);
            }else{
                //remove from list otherwise
                CM.removeProofSelected(x);
            }
        }


        UM.current_obj.is_proof_selected = !UM.current_obj.is_proof_selected;
        if(UM.current_obj.is_proof_selected){
            CM.addProofSelected(UM.current_obj);
        }else{
            //remove from list otherwise
            CM.removeProofSelected(UM.current_obj);
        }

        return;
    }


    //need to perform check after we check if anything under mouse
    if(UM.is_shift_down && UM.is_proof_mode && UM.current_obj !== null){
        UM.current_obj.is_proof_selected = !UM.current_obj.is_proof_selected;

        if(UM.current_obj.is_proof_selected){
            CM.addProofSelected(UM.current_obj);
        }else{
            //remove from list otherwise
            CM.removeProofSelected(UM.current_obj);
        }
    }

}


function onMouseUp(){
    let UM = UserInputManager.getInstance();
    UM.is_mouse_down = false;
    UM.current_obj = null;
}


/**
* corrects the raw mouse position to a mouse position relative to the canvas
* upper left corner is (0,0)
*
* also corrects for HiDPI displays since every canvas pixel
* may not map to every pixel on the physical display
*
* @param {Point} pos - raw mouse position
* @returns {Point}
*/
function getRealMousePos(pos){
    return transformPoint(
        new Point(pos.offsetX, pos.offsetY), getDeviceRatio()
    );
}

/** @param {MouseEvent} e */
function onKeyDown(e){
    let UM = UserInputManager.getInstance();
    if ( e.code === 'ShiftLeft' || e.code === 'ShiftRight' ){
        UM.is_shift_down = true;
    }else if(e.code === 'ControlLeft' || e.code === 'ControlRight' ){
        UM.is_ctrl_down = true;
    }
}


/** @param {MouseEvent} e */
function onKeyUp(e){
    event.preventDefault();
    let UM = UserInputManager.getInstance();
    let CM = CanvasManager.getInstance();
    if ( e.code === 'Escape' ){
        //user decides to not create a cut, clear the temporary
        CM.tmp_cut = null;
    }else if( e.code === 'ShiftLeft' || e.code === 'ShiftRight' ){
        UM.is_shift_down = false;
    }else if( isAlpha(e.code) && !UM.is_ctrl_down && e.code != 'KeyR' && !UM.is_proof_mode){
        CM.addSymbol( new Symbolic(e.code[3], UM.mouse_pos ) );
    }else if( (e.code === 'Delete' || e.code === 'Backspace') && !UM.is_proof_mode ){
        deleteObjectUnderMouse();
    }


    UM.is_shift_down = UM.is_ctrl_down = false;
    function isAlpha(tgt){
        if ( tgt.length != 4 )
            return false;

        let n = tgt.charCodeAt(3);
        return n >=65 && n <= 90;
    }
    e.stopPropagation();
}


/**
* Toggles the different modes in VL, fired by onclick event
*/
function toggleMode(){
    let UM = UserInputManager.getInstance();
    let CM = CanvasManager.getInstance();

    if(CM.is_mini_open){
        return;
    }

    UM.is_proof_mode = !UM.is_proof_mode;

    let tgt = document.getElementById('toggle_mode');

    tgt.innerHTML = UM.is_proof_mode ? 'Proof Mode' : 'Transform Mode';
    tgt.className = 'btn btn-' + (UM.is_proof_mode ? 'proof' : 'transform');
    localStorage.setItem('proof_mode', (UM.is_proof_mode ? 'active' : 'inactive') );

    toggleProofPanel();
}


function toggleProofPanel(){
    let tgt = document.getElementById('proof-panel');
    tgt.style.display = UserInputManager.getInstance().is_proof_mode ? 'block' : 'none';
}

//TODO move somwhere else & remove obj from child cuts 
/** @param{Cut|Symbolic} obj */
function deleteObject(obj){
    let CM = CanvasManager.getInstance();
    function removeFromList(tgt, list){
        for(let i = 0; i < list.length; i++){
            if ( list[i].id === tgt.id ){
                list.splice(i, 1);
                break;
            }
        }
    }

    if( obj instanceof Symbolic ){
        removeFromList(obj, CM.getSyms());
    }else{
        removeFromList(obj, CM.getCuts());
    }


    for(let x of CM.getCuts()){
        removeFromList(obj, x.child_cuts);
        removeFromList(obj, x.child_syms);
    }


    removeFromList(obj,CM.proof_selected);
}

function deleteObjectUnderMouse(){
    let UM = UserInputManager.getInstance();
    if(UM.obj_under_mouse === null){
        return;
    }


    deleteObject(UM.obj_under_mouse);

    UM.obj_under_mouse = null;
}


function toggleDoubleCutButton(){
    let CM = CanvasManager.getInstance();
    document.getElementById('dbl-cut-btn').disabled = CM.proof_selected.length !== 2;
}


function toggleInsertionButton(){
    let CM = CanvasManager.getInstance();
    document.getElementById('insert-btn').disabled = CM.proof_selected.length !== 1;
}

function toggleProofButtons(){
    toggleDoubleCutButton();
    toggleInsertionButton();
}


function toggleOptions(){
    let tgt = document.getElementById('model-background');
    tgt.style.display = tgt.style.display === 'flex' ? 'none' : 'flex';  
}


export {
    UserInputManager,
    toggleMode,
    deleteObject,
    toggleProofButtons
};
