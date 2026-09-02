import { ATM_AMOUNT } from "../lib/constants";
import { AlertIcon, AtmIcon } from "./icons/UiIcons";
import "./BrokeNotice.css";

export default function BrokeNotice({ onAtm }) {
  return (
    <div className="lf-broke">
      <div className="lf-broke__title">
        <AlertIcon className="lf-broke__icon" />
        Running on empty
      </div>
      <p className="lf-broke__text">Your balance is too low to bet. Visit the ATM for a top-up.</p>
      <button className="lf-btn lf-btn--gold" onClick={onAtm}>
        <AtmIcon className="lf-btn__icon" />
        Get ${ATM_AMOUNT} from the ATM
      </button>
    </div>
  );
}
