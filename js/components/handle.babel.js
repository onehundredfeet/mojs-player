import Module  from './module';
import HammerJS from 'hammerjs';
import mojs    from 'mo-js';

require('css/blocks/handle.postcss.css');
let CLASSES = require('css/blocks/handle.postcss.css.json');

class Handle extends Module {
  /*
    Method to declare _defaults.
    @private
    @overrides @ Module
  */
  _declareDefaults () {
    this._defaults = {
      className:      '',
      parent:         document.body,
      minBound:       0,
      maxBound:       1,
      isBound:        false,
      isInversed:     false,
      direction:      'x',
      onSeekStart:    null,
      onSeekEnd:      null,
      onProgress:     null,
      snapPoint:      0,
      snapStrength:   0
    }
  }
  /*
    Method to set handle progress.
    @public
    @param {Number} Progress [0...1].
    @param {Boolean} If should invoke onProgress callback.
    @returns this.
  */
  setProgress ( progress, isCallback = true ) {
    let shift = this._progressToShift( progress );
    this._setShift( shift, isCallback );
    // calc delta and save it
    this._delta = shift - this._shift;
    this._saveDelta();
    return this;
  }
  /*
    Method to set bounds of progress.
    @public
    @param {Number} Min bound to set [0...1].
    @param {Number} Max bound to set [0...1].
    @returns this.
  */
  setBounds ( min, max ) {
    this.setMinBound( min );
    this.setMaxBound( max );
    return this;
  }
  /*
    Method to set min bound of progress.
    @public
    @param {Number} Min bound to set [0...1].
    @returns this.
  */
  setMinBound ( min ) {
    this._props.minBound = Math.max( min, 0 );
    if ( this._progress < min ) { this.setProgress( min ); }
    return this;
  }
  /*
    Method to set max bound of progress.
    @public
    @param {Number} Max bound to set [0...1].
    @returns this.
  */
  setMaxBound ( max ) {
    this._props.maxBound = Math.min( max, 1 );
    if ( this._progress > max ) { this.setProgress( max ); }
    return this;
  }
  /*
    Method to declare properties.
    @private
    @overrides @ Module.
  */
  _vars () {
    // `progress` of the handle [0..1]
    this._progress = 0;
    // `shift` of the handle ( position in `px` )
    this._shift    = 0;
    // `delta` deviation from the current `shift`
    this._delta    = 0;
  }
  /*
    Method to set handle shift.
    @private
    @param {Number} Shift in `px`.
    @param {Boolean} If should invoke onProgress callback.
    @returns {Number}.
  */
  _setShift ( shift, isCallback = true ) {
    let p        = this._props,
        minBound = p.minBound*this._maxWidth,
        maxBound = p.maxBound*this._maxWidth;

    shift = mojs.h.clamp( shift, minBound, maxBound );
    this._applyShift( shift );
    if ( isCallback ) { this._onProgress( shift ); }
    else { this._progress = this._shiftToProgress( shift ); }
    return shift;
  }
  /*
    Method to apply shift to the DOMElement.
    @private
    @param {Number} Shift in pixels.
  */
  _applyShift ( shift ) {
    let p = this._props;
    // translateZ(0)
    this.el.style.transform = ( p.direction === 'x' )
      ? `translateX( ${  shift }px )`
      : `translateY( ${ -shift }px )`;
  }
  /*
    Method to get max width of the parent.
    @private
  */
  _getMaxWidth () {
    let p      = this._props,
        parent = p.parent;

    this._maxWidth = ( p.direction === 'x' )
      ? parent.clientWidth : parent.clientHeight;
  }
  /*
    Method to render the component.
    @private
    @overrides @ Module
  */
  _render () {
    super._render();
    this._addElements();
    this._getMaxWidth();
    this._hammerTime();
  }
  /*
    Method to classes on `this.el`.
    @private
    @overrides @ Module
  */
  _addMainClasses () {
    super._addMainClasses();
    
    let p         = this._props,
        classList = this.el.classList;

    classList.add( CLASSES.handle );
    if ( p.isBound ) { classList.add( CLASSES['is-bound'] ); }
    if ( p.isInversed ) { classList.add( CLASSES['is-inversed'] ); }
  }
  /*
    Method to add DOM elements on render.
    @private
  */
  _addElements () {
    var inner  = this._createElement('div'),
        shadow = this._createElement('div');

    inner.classList.add( `${ CLASSES.handle__inner }` );
    shadow.classList.add( `${ CLASSES.handle__shadow }` );
    this.el.appendChild( shadow );
    this.el.appendChild( inner );
  }
  /*
    Method to initialize HammerJS an set up all even listeners.
    @private
  */
  _hammerTime () {
    let p         = this._props,
        direction = ( p.direction === 'x' ) ? 'HORIZONTAL' : 'VERTICAL',
        hm        = new HammerJS.Manager(this.el, {
          recognizers: [
            [HammerJS.Pan, { direction: HammerJS[ `DIRECTION_${direction}` ] }]
          ]
        });

    hm.on('pan', ( e ) => {
      this._delta = ( p.direction === 'x' ) ? e.deltaX : -e.deltaY;
      // get progress from the shift to undestand how far is the snapPoint
      let shift = this._shift + this._delta,
          proc  = this._shiftToProgress( shift );
      // if progress is around snapPoint set it to the snap point
      proc = ( Math.abs( proc - p.snapPoint ) < p.snapStrength )
        ? p.snapPoint : proc;
      // recalculate the progress to shift and set it
      this._setShift( this._progressToShift( proc ) );
    });

    hm.on('panend', ( e ) => {
      this._saveDelta();
      this._callIfFunction( p.onSeekEnd, [ e ] );
    });

    this._addPointerDownEvent( this.el, (e) => {
      this._isPointerDown = true;
      this._callIfFunction( p.onSeekStart, [ e ] );
    });
    
    this._addPointerUpEvents();
  }
  /*
    Method to add pointer up events to handle the pointer up event.
  */
  _addPointerUpEvents () {
    let p = this._props;
    this._addPointerUpEvent( this.el, (e) => {
      this._callIfFunction( p.onSeekEnd, [ e ] );
    });
    // add listener on document to cover edge cases
    // like when you press -> leave the element -> release
    this._addPointerUpEvent( document, (e) => {
      if ( this._isPointerDown ) {
        this._callIfFunction( p.onSeekEnd, [ e ] );
        this._isPointerDown = false;
      }
    });
  }
  /*
    Method to add _delta to _shift.
    @private
  */
  _saveDelta () { this._shift += this._delta; }
  /*
    Method to call onProgress callback.
    @private
    @param {Number} Shift in `px`.
  */
  _onProgress ( shift ) {
    let p        = this._props,
        progress = this._shiftToProgress( shift );

    if ( this._progress !== progress ) {
      this._progress = progress;
      if ( this._isFunction( p.onProgress ) ) {
        p.onProgress.call( this, progress );
      }
    }
  }
  /*
    Method to recalc shift to progress.
    @private
    @param {Number} Shift in `px`.
    @returns {Number} Progress [0...1].
  */
  _shiftToProgress ( shift ) {
    return shift / this._maxWidth;
  }
  /*
    Method to progress shift to shift.
    @private
    @param   {Number} Progress [0...1].
    @returns {Number} Shift in `px`.

  */
  _progressToShift ( progress ) {
    return progress*this._maxWidth;
  }
}

export default Handle;