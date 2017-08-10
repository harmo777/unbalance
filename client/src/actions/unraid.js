import * as constant from '../lib/const'

module.exports = {
	getStorage,
	gotStorage,

	checkFrom,
	checkTo,

	calculate,
	calcStarted,
	calcProgress,
	calcFinished,
	calcPermIssue,

	move,
	copy,
	transferStarted,
	transferProgress,
	transferFinished,

	validate,

	opError,
	progressStats,

	getLog,
	gotLog,

	findTargets,
	findFinished,

	checkTarget,

	gather,
	gatherFinished,
}

function getStorage({ state, actions, opts: { api } }) {
	actions.setOpInProgress('Getting storage info')

	api.getStorage().then(json => actions.gotStorage(json))

	return {
		...state,
		unraid: null,
	}
}

function gotStorage({ state, actions }, unraid) {
	const toDisk = {}
	const fromDisk = {}
	let sourceDisk = null

	unraid.disks.forEach(disk => {
		fromDisk[disk.path] = disk.src
		toDisk[disk.path] = disk.dst
		if (disk.src) {
			sourceDisk = disk
		}
	})

	const lines = []
	let opState = null
	switch (unraid.opState) {
		case constant.stateCalc:
			opState = 'Calculate operation in progress ...'
			break
		case constant.stateMove:
			opState = 'Move operation in progress ...'
			break
		case constant.stateCopy:
			opState = 'Copy operation in progress ...'
			break
		case constant.stateValidate:
			opState = 'Validate operation in progress ...'
			break
		case constant.stateFindTargets:
			opState = 'Find target operation in progress ...'
			break
		default:
			break
	}

	const tree = Object.assign({}, state.tree)
	if (opState) {
		lines.push(opState)
	} else {
		// console.log(`sourceDisk-${JSON.stringify(sourceDisk)}`)
		// scatter tree
		if (sourceDisk) {
			actions.getTree(sourceDisk.path)
			tree.cache = null
			tree.items = [{ label: 'Loading ...' }]
			tree.chosen = {}
		}
	}

	return {
		...state,
		unraid,
		fromDisk,
		toDisk,
		opInProgress: opState,
		stats: unraid.stats,
		transferDisabled: true,
		validateDisabled: unraid.prevState !== constant.stateCopy,
		lines,
		tree,
	}
}

function checkFrom({ state, actions }, path) {
	const fromDisk = Object.assign({}, state.fromDisk)
	const toDisk = Object.assign({}, state.toDisk)

	Object.keys(fromDisk).forEach(key => (fromDisk[key] = key === path))
	Object.keys(toDisk).forEach(key => (toDisk[key] = !(key === path)))

	actions.changeDisk(path)

	return {
		...state,
		fromDisk,
		toDisk,
		validateDisabled: true,
	}
}

function checkTo({ state }, path) {
	return {
		...state,
		toDisk: {
			...state.toDisk,
			[path]: !state.toDisk[path],
		},
		validateDisabled: true,
	}
}

function calculate({ state, actions, opts: { ws } }) {
	actions.setOpInProgress('Calculating')

	let srcDisk = ''
	Object.keys(state.fromDisk).some(key => {
		const isSource = state.fromDisk[key]
		isSource && (srcDisk = key)
		return isSource
	})

	const folders = Object.keys(state.tree.chosen).map(folder => folder.slice(srcDisk.length + 1))

	ws.send({ topic: 'calculate', payload: { srcDisk, folders, dstDisks: state.toDisk } })

	return state
}

function calcStarted({ state }, line) {
	return {
		...state,
		lines: [].concat(`CALCULATE: ${line}`),
		unraid: {
			...state.unraid,
			disks: state.unraid.disks.map(disk => {
				disk.newFree = disk.free
				return disk
			}),
		},
	}
}

function calcProgress({ state }, line) {
	const lines = state.lines.length > 1000 ? [] : state.lines

	return {
		...state,
		opInProgress: 'calculate',
		transferDisabled: true,
		lines: lines.concat(`CALCULATE: ${line}`),
	}
}

function calcFinished({ state, actions }, unraid) {
	const feedback = []
	if (unraid.bytesToTransfer === 0) {
		feedback.push('The calculate operation found that no folders/files can be moved/copied.')
		feedback.push('')
		feedback.push('This might be due to one of the following reasons:')
		feedback.push(
			'- The source share(s)/folder(s) you selected are either empty or do not exist in the source disk',
		)
		feedback.push(
			"- There isn't available space in any of the target disks, to move/copy the share(s)/folder(s) you selected",
		)
		feedback.push('')
		feedback.push(
			'Check more disks in the TO column or go to the Settings page, to review the share(s)/folder(s) selected for moving/copying or to change the amount of reserved space.',
		)
	}

	if (state.timeout) {
		window.clearTimeout(state.timeout)
	}
	const timeout = window.setTimeout(() => actions.removeFeedback(), 15 * 1000)

	return {
		...state,
		unraid,
		feedback,
		timeout,
		opInProgress: null,
		transferDisabled: unraid.bytesToTransfer === 0,
		validateDisabled: unraid.prevState !== constant.stateCopy,
	}
}

function calcPermIssue({ state, actions }, permStats) {
	const permIssues = permStats.split('|')

	const feedback = []

	feedback.push('There are some permission issues with the folders/files you want to move')
	feedback.push(`${permIssues[0]} file(s)/folder(s) with an owner other than 'nobody'`)
	feedback.push(`${permIssues[1]} file(s)/folder(s) with a group other than 'users'`)
	feedback.push(`${permIssues[2]} folder(s) with a permission other than 'drwxrwxrwx'`)
	feedback.push(`${permIssues[3]} files(s) with a permission other than '-rw-rw-rw-' or '-r--r--r--'`)
	feedback.push('You can find more details about which files have issues in the log file (/boot/logs/unbalance.log)')
	feedback.push('')
	feedback.push(
		'At this point, you can move the folders/files if you want, but be advised that it can cause errors in the operation',
	)
	feedback.push('')
	feedback.push(
		'You are STRONGLY suggested to install the Fix Common Problems plugin, then run the Docker Safe New Permissions command',
	)

	if (state.timeout) {
		window.clearTimeout(state.timeout)
	}
	const timeout = window.setTimeout(() => actions.removeFeedback(), 5 * 60 * 1000) // 60s timeout

	return {
		...state,
		feedback,
		timeout,
		opInProgress: null,
		transferDisabled: false,
	}
}

function move({ state, actions, opts: { ws } }) {
	actions.setOpInProgress('MOVE')

	ws.send({ topic: 'move' })

	return state
}

function copy({ state, actions, opts: { ws } }) {
	actions.setOpInProgress('COPY')

	ws.send({ topic: 'copy' })

	return state
}

function transferStarted({ state }, line) {
	return {
		...state,
		lines: [].concat(`${state.opInProgress}: ${line}`),
	}
}

function transferProgress({ state, actions }, line) {
	const lines = state.lines.length > 1000 ? [] : state.lines

	return {
		...state,
		lines: lines.concat(`${state.opInProgress}: ${line}`),
	}
}

function transferFinished({ state, actions }) {
	actions.getStorage()

	return {
		...state,
		opInProgress: null,
		stats: '',
		transferDisabled: !state.config.dryRun,
	}
}

function validate({ state, actions, opts: { ws } }) {
	actions.setOpInProgress('VALIDATE')

	ws.send({ topic: 'validate' })

	return state
}

function opError({ state, actions }, error) {
	actions.addFeedback(error)
	return state
}

function progressStats({ state, actions }, stats) {
	return {
		...state,
		stats,
	}
}

function getLog({ state, actions, opts: { ws } }) {
	actions.setOpInProgress('Getting logs ...')

	ws.send({ topic: 'getLog' })

	return state
}

function gotLog({ state }, log) {
	return {
		...state,
		opInProgress: null,
		log,
	}
}

function findTargets({ state, actions, opts: { ws } }) {
	actions.setOpInProgress('Calculating')

	const folders = Object.keys(state.gatherTree.chosen).map(folder => folder.slice(10))
	ws.send({ topic: 'findTargets', payload: folders })

	return {
		...state,
		gatherTree: {
			...state.gatherTree,
			target: null,
		},
	}
}

function findFinished({ state, actions }, unraid) {
	const feedback = []
	if (unraid.bytesToTransfer === 0) {
		feedback.push('The calculate operation found that no folders/files can be moved/copied.')
		feedback.push('')
		feedback.push('This might be due to one of the following reasons:')
		feedback.push(
			'- The source share(s)/folder(s) you selected are either empty or do not exist in the source disk',
		)
		feedback.push(
			"- There isn't available space in any of the target disks, to move/copy the share(s)/folder(s) you selected",
		)
		feedback.push('')
		feedback.push(
			'Check more disks in the TO column or go to the Settings page, to review the share(s)/folder(s) selected for moving/copying or to change the amount of reserved space.',
		)
	}

	if (state.timeout) {
		window.clearTimeout(state.timeout)
	}
	const timeout = window.setTimeout(() => actions.removeFeedback(), 15 * 1000)

	return {
		...state,
		unraid,
		feedback,
		timeout,
		opInProgress: null,
		transferDisabled: unraid.bytesToTransfer === 0,
		validateDisabled: unraid.prevState !== constant.stateCopy,
	}
}

function checkTarget({ state }, drive, checked) {
	const disks = state.unraid.disks.map(disk => {
		return disk.path === drive.path
			? Object.assign({}, disk, { dst: checked })
			: Object.assign({}, disk, { dst: false })
	})

	const target = checked ? drive : null

	return {
		...state,
		unraid: {
			...state.unraid,
			disks,
		},
		gatherTree: {
			...state.gatherTree,
			target,
		},
	}
}

function gather({ state, actions, opts: { ws } }, drive) {
	actions.setOpInProgress('MOVE')

	ws.send({ topic: 'gather', payload: drive })

	return state
}

function gatherFinished({ state, actions }) {
	actions.getStorage()

	state.history.replace({ pathname: '/gather' })

	return {
		...state,
		opInProgress: null,
		stats: '',
		transferDisabled: !state.config.dryRun,
		gatherTree: {
			cache: null,
			items: [{ label: 'Loading ...' }],
			chosen: {},
			present: [],
			target: null,
		},
	}
}
