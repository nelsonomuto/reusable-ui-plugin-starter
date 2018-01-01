import 'jquery';
import styles from './main.scss';

$(document).ready(() => {
    $(document.body).addClass(styles.testCls);
    console.log('shared main.js');
});
