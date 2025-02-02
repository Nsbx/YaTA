import {
  Button,
  ButtonGroup,
  Classes,
  Colors,
  EditableText,
  Icon,
  Intent,
  Menu,
  MenuItem,
  Popover,
  Spinner,
  Text,
  Tooltip,
} from '@blueprintjs/core'
import _ from 'lodash'
import pluralize from 'pluralize'
import { Component } from 'react'
import { connect } from 'react-redux'

import ExternalButton from 'components/ExternalButton'
import FlexLayout from 'components/FlexLayout'
import History from 'components/History'
import ReasonDialog from 'components/ReasonDialog'
import { ToggleableUI } from 'constants/toggleable'
import ActionMenuItems from 'containers/ActionMenuItems'
import Dialog from 'containers/Dialog'
import { ActionHandler, SerializedAction } from 'libs/Action'
import { SerializedChatter, WithNameColorProps } from 'libs/Chatter'
import { SerializedMessage } from 'libs/Message'
import Twitch, { RawHelixUser, RawRelationship } from 'libs/Twitch'
import { isMessage } from 'store/ducks/logs'
import { updateNote } from 'store/ducks/notes'
import { ApplicationState } from 'store/reducers'
import { getChannel } from 'store/selectors/app'
import { makeGetChatterLogs } from 'store/selectors/chatters'
import { getLogsByIds } from 'store/selectors/logs'
import { makeGetChatterNote } from 'store/selectors/notes'
import styled, { ifProp, prop, size, theme } from 'styled'
import Ivr, { IvrSubscriptionStatus } from 'libs/Ivr'

/**
 * DetailsRow component.
 */
const DetailsRow = styled(FlexLayout)<DetailsRowProps>`
  align-items: center;
  color: ${ifProp('error', Colors.GRAY5, 'unset')};
  height: ${ifProp('open', '127px', 'auto')};
  margin-bottom: 18px;

  .${Classes.SPINNER}.${Classes.SMALL} {
    margin-right: 15px;
  }
`

/**
 * DetailsCell component.
 */
const DetailsCell = styled.div`
  border-right: 1px solid ${theme('chatter.details.border')};
  color: ${theme('chatter.details.color')};
  font-size: 0.82rem;
  padding: 0 20px 0 12px;

  &:first-of-type {
    padding-left: 0;
  }

  &:last-of-type {
    border-right: 0;
  }

  & > strong,
  & > .${Classes.TEXT_OVERFLOW_ELLIPSIS} {
    color: ${theme('chatter.details.strong')};
    display: block;
    font-weight: 600;
    font-size: 0.9rem;
    padding-bottom: 3px;
  }
`

/**
 * Header component.
 */
const Header = styled(FlexLayout)`
  align-items: center;
`

/**
 * Avatar component.
 */
const Avatar = styled.div`
  align-items: center;
  background-color: ${Colors.GRAY5};
  border-radius: 50%;
  display: flex;
  height: ${size('chatter.avatar.size')};
  justify-content: center;
  margin: ${size('chatter.avatar.margin')};
  width: ${size('chatter.avatar.size')};

  & > img {
    border-radius: 50%;
    display: block;
    height: ${size('chatter.avatar.size')};
    width: ${size('chatter.avatar.size')};
  }

  & .${Classes.ICON} svg,
  .${Classes.DARK} & .${Classes.ICON} svg {
    color: ${Colors.DARK_GRAY5};
    display: block;
    height: ${size('chatter.avatar.size', -15)};
    margin: 0;
    margin-left: 9px;
    width: ${size('chatter.avatar.size', -15)};
  }
`

/**
 * Name component.
 */
const Name = styled.span<WithNameColorProps>`
  color: ${prop('color')};
  font-weight: bold;
  padding-right: 2px;
`

/**
 * Badges component.
 */
const Badges = styled.span`
  margin-left: 9px;

  .badge {
    border-radius: 50%;
    display: inline-block;
    margin-top: -1px;
    min-width: 18px;
    margin-right: 6px;
    vertical-align: middle;

    &:last-of-type {
      margin-right: 6px;
    }
  }
`

/**
 * Tools component.
 */
const Tools = styled.div`
  margin-bottom: 10px;

  & > a,
  & > button,
  & > span.${Classes.POPOVER_WRAPPER} {
    margin-right: 10px;
  }

  & > div {
    margin-bottom: 10px;

    & > button,
    & > div.${Classes.BUTTON_GROUP} {
      margin-right: 10px;
    }
  }
`

/**
 * ButtonRow component.
 */
const ButtonRow = styled.div`
  display: flex;
`

/**
 * Divider component.
 */
const Divider = styled.div`
  border-bottom: 1px solid hsla(0, 0%, 100%, 0.15);
  box-sizing: content-box;
  height: 0;
  margin: 20px 0;
  overflow: visible;
`

/**
 * Note component.
 */
const Note = styled(EditableText)`
  margin-top: 20px;
`

/**
 * ErrorIcon component.
 */
const ErrorIcon = styled(Icon)`
  margin-right: 9px;
`

/**
 * React State.
 */
const initialState = {
  error: undefined as Optional<Error>,
  followersCount: undefined as Optional<number>,
  isEditingNote: false,
  relationship: undefined as Optional<RawRelationship> | null,
  subscriptionStatus: undefined as Optional<IvrSubscriptionStatus> | null,
  user: undefined as Optional<RawHelixUser>,
  [ToggleableUI.Reason]: false,
}
type State = Readonly<typeof initialState>

/**
 * ChatterDetails Component.
 */
class ChatterDetails extends Component<Props, State> {
  public state: State = initialState

  /**
   * Lifecycle: componentDidUpdate.
   * @param prevProps - The previous props.
   */
  public async componentDidUpdate(prevProps: Props) {
    const { channel, chatter } = this.props

    if (!_.isNil(chatter) && prevProps.chatter !== chatter) {
      try {
        let id: string

        if (chatter.isSelf) {
          id = Twitch.getAuthenticatedUserId()
        } else {
          id = chatter.id
        }

        const response = await Promise.all([
          Twitch.fetchUserByName(chatter.userName),
          Twitch.fetchRelationship(id),
          Twitch.fetchFollowersCount(id),
        ])

        const [user, relationship, followersCount] = response

        let subscriptionStatus: IvrSubscriptionStatus | null = null

        if (!_.isNil(channel)) {
          try {
            subscriptionStatus = await Ivr.fetchSubscriptionStatus(chatter.userName, channel)
          } catch (error) {
            //
          }
        }

        this.setState(() => ({
          followersCount,
          error: undefined,
          relationship,
          subscriptionStatus,
          user,
        }))
      } catch (error) {
        this.setState(() => ({ error }))
      }
    } else if (_.isNil(chatter) && prevProps.chatter !== chatter) {
      this.setState(initialState)
    }
  }

  /**
   * Renders the component.
   * @return Element to render.
   */
  public render() {
    const { chatter, logs } = this.props
    const { isEditingNote, [ToggleableUI.Reason]: showReasonDialog, user } = this.state

    if (_.isNil(chatter)) {
      return null
    }

    const lastMessage = _.last(logs)
    const badges = !_.isNil(lastMessage) && isMessage(lastMessage) ? lastMessage.badges : null

    const showUsername = _.get(chatter, 'showUsername', false)
    const usernameColor = chatter.color as string

    const header = (
      <Header>
        <Avatar>
          {_.isNil(user) ? (
            <Icon icon="person" />
          ) : (
            <img src={user.profile_image_url} alt={`${chatter.displayName} avatar`} />
          )}
        </Avatar>
        <Name color={usernameColor}>{`${chatter.displayName}${showUsername ? ` (${chatter.userName})` : ''}`}</Name>
        {!_.isNil(badges) && <Badges dangerouslySetInnerHTML={{ __html: badges }} />}
      </Header>
    )

    return (
      <Dialog
        canOutsideClickClose={!isEditingNote}
        canEscapeKeyClose={!isEditingNote}
        isOpen={!_.isNil(chatter)}
        onClose={this.onClose}
        title={header}
      >
        <ReasonDialog
          onConfirmBanReason={this.onConfirmBanReason}
          toggle={this.toggleReasonAlert}
          visible={showReasonDialog}
        />
        <div className={Classes.DIALOG_BODY}>
          {this.renderDetails()}
          {this.renderModerationTools()}
          {this.renderHistory()}
          {this.renderNote()}
        </div>
      </Dialog>
    )
  }

  /**
   * Triggered when the dialog should be closed.
   */
  private onClose = () => {
    this.setState(() => initialState)

    this.props.unfocus()
  }

  /**
   * Toggles the reason alert.
   */
  private toggleReasonAlert = () => {
    this.setState(({ [ToggleableUI.Reason]: showReasonDialog }) => ({ [ToggleableUI.Reason]: !showReasonDialog }))
  }

  /**
   * Renders the note.
   * @return Element to render.
   */
  private renderNote() {
    const { chatter, note } = this.props

    if (_.isNil(chatter) || chatter.isSelf) {
      return null
    }

    return (
      <Note
        placeholder="Click to add a note…"
        onConfirm={this.onConfirmNote}
        onChange={this.onChangeNote}
        onCancel={this.onCancelNote}
        onEdit={this.onEditNote}
        minLines={1}
        maxLines={5}
        value={note}
        multiline
      />
    )
  }

  /**
   * Renders the moderation tools.
   * @return Element to render.
   */
  private renderModerationTools() {
    const { canModerate, chatter } = this.props

    if (_.isNil(chatter) || !canModerate(chatter)) {
      return null
    }

    const banMenu = (
      <Menu>
        <MenuItem text="Ban with reason" icon="disable" onClick={this.toggleReasonAlert} />
      </Menu>
    )

    return (
      <>
        <Divider />
        <Tools>
          <ButtonRow>
            <Button icon="trash" onClick={this.onClickPurge} text="Purge" />
            <ButtonGroup>
              <Button icon="disable" intent={Intent.DANGER} onClick={this.onClickBan} text="Ban" />
              <Popover content={banMenu} usePortal={false}>
                <Button icon="caret-down" intent={Intent.DANGER} />
              </Popover>
            </ButtonGroup>
            {chatter.banned && <Button icon="unlock" intent={Intent.DANGER} onClick={this.onClickUnban} text="Unban" />}
            <Tooltip content="Open the Twitch viewer card for this user">
              <Button icon="torch" onClick={this.onClickTwitchViewerCard} text="Twitch Viewer Card" />
            </Tooltip>
          </ButtonRow>
          <ButtonRow>
            <ButtonGroup>
              <Button icon="time" onClick={this.onClickTimeout10M} text="10m" />
              <Button icon="time" onClick={this.onClickTimeout1H} text="1h" />
              <Button icon="time" onClick={this.onClickTimeout6H} text="6h" />
              <Button icon="time" onClick={this.onClickTimeout24H} text="24h" />
            </ButtonGroup>
          </ButtonRow>
        </Tools>
      </>
    )
  }

  /**
   * Renders the chatter details.
   * @return Element to render.
   */
  private renderDetails() {
    const { error, followersCount, relationship, user } = this.state
    const { chatter } = this.props

    if (_.isNil(chatter)) {
      return null
    } else if (!_.isNil(error)) {
      return (
        <DetailsRow error>
          <ErrorIcon icon="error" />
          Something went wrong while fetching user details!
        </DetailsRow>
      )
    }

    if (_.isUndefined(followersCount) || _.isUndefined(relationship) || _.isUndefined(user)) {
      return (
        <DetailsRow open>
          <Spinner className={Classes.SMALL} intent={Intent.PRIMARY} /> Fetching user details…
        </DetailsRow>
      )
    }

    const followed = !_.isNil(relationship)
    const channelUrl = `https://www.twitch.tv/${user.login}`

    return (
      <>
        <DetailsRow>
          {this.renderSubAge()}
          <DetailsCell>
            <strong>{new Date(user.created_at).toLocaleDateString()}</strong> Creation
          </DetailsCell>
          {this.renderFollowAge()}
          <DetailsCell>
            <strong>{user.view_count.toLocaleString()}</strong> Views
          </DetailsCell>
          <DetailsCell>
            <strong>{followersCount.toLocaleString()}</strong> Followers
          </DetailsCell>
        </DetailsRow>
        {!chatter.isSelf && (
          <Tools>
            <Button icon="envelope" onClick={this.onClickWhisper} text="Whisper" />
            <Button
              icon={followed ? 'follower' : 'following'}
              intent={Intent.PRIMARY}
              onClick={this.onClickFollowUnfollow}
              text={followed ? 'Unfollow' : 'Follow'}
            />
            <Button
              icon="blocked-person"
              intent={Intent.DANGER}
              onClick={this.onClickBlockUnblock}
              text={chatter.blocked ? 'Unblock' : 'Block'}
            />
            <ExternalButton intent={Intent.DANGER} text="Report" icon="badge" href={`${channelUrl}/report`} />
          </Tools>
        )}
        <Tools>
          <ExternalButton text="Open Channel" icon="document-open" href={channelUrl} />
          <Popover content={<ActionMenuItems actionHandler={this.actionHandler} wrap />} usePortal={false}>
            <Button icon="caret-down" />
          </Popover>
        </Tools>
      </>
    )
  }

  /**
   * Renders the chatter messages history if possible.
   * @return Element to render.
   */
  private renderHistory() {
    const { copyMessageOnDoubleClick, copyMessageToClipboard, logs } = this.props

    if (_.isNil(logs) || logs.length === 0) {
      return null
    }

    return (
      <History
        copyMessageOnDoubleClick={copyMessageOnDoubleClick}
        copyMessageToClipboard={copyMessageToClipboard}
        logs={logs}
      />
    )
  }

  /**
   * Renders the subscription age.
   * @return Element to render.
   */
  private renderSubAge() {
    const { subscriptionStatus } = this.state

    if (
      !subscriptionStatus ||
      subscriptionStatus.hidden ||
      !subscriptionStatus.cumulative.months ||
      subscriptionStatus.cumulative.months === 0
    ) {
      return null
    }

    const title = subscriptionStatus.subscribed ? 'Sub' : 'Past sub'

    return (
      <DetailsCell>
        <Text ellipsize>
          {subscriptionStatus.cumulative.months} {pluralize('months', subscriptionStatus.cumulative.months)}
        </Text>
        {title}
      </DetailsCell>
    )
  }

  /**
   * Renders the follow age.
   * @return Element to render.
   */
  private renderFollowAge() {
    const { subscriptionStatus } = this.state

    if (!subscriptionStatus || !subscriptionStatus.followedAt) {
      return null
    }

    return (
      <DetailsCell>
        <strong>{new Date(subscriptionStatus.followedAt).toLocaleDateString()}</strong> Follow
      </DetailsCell>
    )
  }

  /**
   * Triggered when the user cancels of editing the note.
   */
  private onCancelNote = () => {
    this.setState(() => ({ isEditingNote: false }))
  }

  /**
   * Triggered when the user starts editing the note.
   */
  private onEditNote = () => {
    this.setState(() => ({ isEditingNote: true }))
  }

  /**
   * Triggered when the user confirms the edition of the note.
   */
  private onConfirmNote = () => {
    this.setState(() => ({ isEditingNote: false }))
  }

  /**
   * Triggered when the note for the current chatter is edited.
   * @param event - The associated event.
   */
  private onChangeNote = (note: string) => {
    const { chatter } = this.props

    if (!_.isNil(chatter)) {
      this.props.updateNote(chatter.id, note)
    }
  }

  /**
   * Triggered when the ban with reason is clicked.
   * @param reason - The ban reason.
   */
  private onConfirmBanReason = (reason: string) => {
    this.toggleReasonAlert()

    const { ban, chatter, unfocus } = this.props

    if (!_.isNil(chatter)) {
      ban(chatter.userName, reason)
    }

    unfocus()
  }

  /**
   * Triggered when the Twitch viewer card button is clicked.
   */
  private onClickTwitchViewerCard = () => {
    const { chatter, openTwitchViewerCard } = this.props

    openTwitchViewerCard(chatter)
  }

  /**
   * Triggered when purge button is clicked.
   */
  private onClickPurge = () => {
    this.timeout(1)
  }

  /**
   * Triggered when 10 minutes timeout button is clicked.
   */
  private onClickTimeout10M = () => {
    this.timeout(600)
  }

  /**
   * Triggered when 1 hour timeout button is clicked.
   */
  private onClickTimeout1H = () => {
    this.timeout(3600)
  }

  /**
   * Triggered when 6 hours timeout button is clicked.
   */
  private onClickTimeout6H = () => {
    this.timeout(21600)
  }

  /**
   * Triggered when 24 hours timeout button is clicked.
   */
  private onClickTimeout24H = () => {
    this.timeout(86400)
  }

  /**
   * Timeouts a user.
   * @param duration - The duration of the timeout in seconds.
   */
  private timeout(duration: number) {
    const { chatter, timeout, unfocus } = this.props

    if (!_.isNil(chatter)) {
      timeout(chatter.userName, duration)
    }

    unfocus()
  }

  /**
   * Triggered when the ban button is clicked.
   */
  private onClickBan = () => {
    const { ban, chatter, unfocus } = this.props

    if (!_.isNil(chatter)) {
      ban(chatter.userName)
    }

    unfocus()
  }

  /**
   * Triggered when the unban button is clicked.
   */
  private onClickUnban = () => {
    const { chatter, unban, unfocus } = this.props

    if (!_.isNil(chatter)) {
      unban(chatter.userName)
    }

    unfocus()
  }

  /**
   * Triggered when the follow or unfollow button is clicked.
   */
  private onClickFollowUnfollow = () => {
    const { channel, unfocus } = this.props

    if (channel) {
      Twitch.openChannel(channel)
    }

    unfocus()
  }

  /**
   * Triggered when the block or unblock button is clicked.
   */
  private onClickBlockUnblock = () => {
    const { block, chatter, unblock, unfocus } = this.props

    if (!_.isNil(chatter)) {
      if (chatter.blocked) {
        unblock(chatter.id)
      } else {
        block(chatter.id)
      }
    }

    unfocus()
  }

  /**
   * Triggered when the whisper button is clicked.
   */
  private onClickWhisper = () => {
    const { chatter, unfocus, whisper } = this.props

    if (!_.isNil(chatter)) {
      whisper(chatter.userName)
    }

    unfocus()
  }

  /**
   * Handle an action triggered from the details screen.
   * @param action - The action to execute.
   */
  private actionHandler = (action: SerializedAction) => {
    const { actionHandler, unfocus } = this.props

    actionHandler(action, undefined)

    unfocus()
  }
}

export default connect<StateProps, DispatchProps, OwnProps, ApplicationState>(
  (state, ownProps: OwnProps) => {
    const getChatterLogs = makeGetChatterLogs()
    const getChatterNote = makeGetChatterNote()

    return {
      channel: getChannel(state),
      logs: !_.isNil(ownProps.chatter) ? getLogsByIds(state, getChatterLogs(state, ownProps.chatter.id)) : null,
      note: !_.isNil(ownProps.chatter) ? getChatterNote(state, ownProps.chatter.id) : '',
    }
  },
  { updateNote }
)(ChatterDetails)

/**
 * React Props.
 */
interface StateProps {
  channel: ReturnType<typeof getChannel>
  logs: ReturnType<typeof getLogsByIds> | null
  note: string
}

/**
 * React Props.
 */
interface DispatchProps {
  updateNote: typeof updateNote
}

/**
 * React Props.
 */
interface OwnProps {
  actionHandler: ActionHandler
  ban: (username: string, reason?: string) => void
  block: (targetId: string) => void
  canModerate: (chatter: SerializedChatter) => boolean
  chatter?: SerializedChatter
  copyMessageOnDoubleClick: boolean
  copyMessageToClipboard: (message: SerializedMessage | SerializedMessage[]) => void
  openTwitchViewerCard: (user: Optional<SerializedChatter>) => void
  timeout: (username: string, duration: number) => void
  unban: (username: string) => void
  unblock: (targetId: string) => void
  unfocus: () => void
  whisper: (username: string) => void
}

/**
 * React Props.
 */
type Props = OwnProps & DispatchProps & StateProps

/**
 * React Props.
 */
interface DetailsRowProps {
  error?: boolean
  open?: boolean
}
