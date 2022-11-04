import './App.css';
import * as React from 'react';

const AlertStatus = (props) => {
  return <span className={props.elapsedTime > 1 ? 'AlertRed' : ''}>{props.elapsedTime} hours</span>
}

export default AlertStatus;