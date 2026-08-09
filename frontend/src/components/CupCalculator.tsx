import { useMemo, useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material'

type Inputs = {
    underBustRelaxed: string
    underBustExhale: string
    bustRelaxed: string
    bustBend45: string
    bustBend90: string
}

type Result = {
    isValid: boolean
    underBust: number | null
    cupDifference: number | null
    cupSize: string | null
    bandSize: number | null
    fullSize: string | null
    message: string
}

const CUP_TABLE = [
    { threshold: 5, size: 'Below AA', message: 'You may not need a bra yet.' },
    { threshold: 7.5, size: 'AA', message: 'AA — a light bralette may be a good fit.' },
    { threshold: 10, size: 'A', message: '' },
    { threshold: 12.5, size: 'B', message: '' },
    { threshold: 15, size: 'C', message: '' },
    { threshold: 17.5, size: 'D', message: '' },
    { threshold: 20, size: 'E', message: '' },
    { threshold: Number.POSITIVE_INFINITY, size: 'E+', message: 'Your cup size is beyond the preset range.' },
]

const toNumber = (v: string) => {
    const n = Number.parseFloat(v)
    return Number.isNaN(n) ? null : n
}

const calcCup = (inputs: Inputs): Result => {
    const underBustRelaxed = toNumber(inputs.underBustRelaxed)
    const underBustExhale = toNumber(inputs.underBustExhale)
    const bustRelaxed = toNumber(inputs.bustRelaxed)
    const bustBend45 = toNumber(inputs.bustBend45)
    const bustBend90 = toNumber(inputs.bustBend90)

    if (
        underBustRelaxed == null ||
        underBustExhale == null ||
        bustRelaxed == null ||
        bustBend45 == null ||
        bustBend90 == null
    ) {
        return {
            isValid: false,
            underBust: null,
            cupDifference: null,
            cupSize: null,
            bandSize: null,
            fullSize: null,
            message: 'Please enter all five measurements.',
        }
    }

    if (
        underBustRelaxed <= 0 ||
        underBustExhale <= 0 ||
        bustRelaxed <= 0 ||
        bustBend45 <= 0 ||
        bustBend90 <= 0
    ) {
        return {
            isValid: false,
            underBust: null,
            cupDifference: null,
            cupSize: null,
            bandSize: null,
            fullSize: null,
            message: 'Please check the measurements you entered.',
        }
    }

    const underBust = (underBustRelaxed + underBustExhale) / 2
    const bustAvg = (bustRelaxed + bustBend45 + bustBend90) / 3
    const cupDiff = bustAvg - underBust

    if (cupDiff < 0) {
        return {
            isValid: false,
            underBust,
            cupDifference: cupDiff,
            cupSize: null,
            bandSize: null,
            fullSize: null,
            message: 'Please check your measurements.',
        }
    }

    const hit = CUP_TABLE.find((x) => cupDiff <= x.threshold) ?? CUP_TABLE[CUP_TABLE.length - 1]
    const bandSize = 5 * Math.ceil(underBust / 5)
    const fullSize = hit.size === 'Below AA' ? `${bandSize} band, below AA cup` : `${bandSize}${hit.size}`

    return {
        isValid: true,
        underBust,
        cupDifference: cupDiff,
        cupSize: hit.size,
        bandSize,
        fullSize,
        message: hit.message || `Your estimated bra size is ${fullSize}.`,
    }
}

export default function CupCalculator() {
    const [inputs, setInputs] = useState<Inputs>({
        underBustRelaxed: '',
        underBustExhale: '',
        bustRelaxed: '',
        bustBend45: '',
        bustBend90: '',
    })
    const [result, setResult] = useState<Result | null>(null)

    const isComplete = useMemo(() => Object.values(inputs).every((v) => v.trim() !== ''), [inputs])

    return (
        <Card sx={{ maxWidth: 720, mx: 'auto' }}>
            <CardContent>
                <Typography variant="h5" fontWeight={800}>
                    Bra Size Calculator
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.7, mt: 1 }}>
                    Enter five measurements in centimeters. Results are estimates only.
                </Typography>

                <Stack spacing={2} sx={{ mt: 2 }}>
                    <TextField
                        label="Underbust, relaxed (cm)"
                        value={inputs.underBustRelaxed}
                        onChange={(e) => setInputs((s) => ({ ...s, underBustRelaxed: e.target.value }))}
                        type="number"
                        inputProps={{ min: 0, step: 0.1 }}
                        fullWidth
                    />
                    <TextField
                        label="Underbust, exhaled (cm)"
                        value={inputs.underBustExhale}
                        onChange={(e) => setInputs((s) => ({ ...s, underBustExhale: e.target.value }))}
                        type="number"
                        inputProps={{ min: 0, step: 0.1 }}
                        fullWidth
                    />
                    <TextField
                        label="Bust, relaxed (cm)"
                        value={inputs.bustRelaxed}
                        onChange={(e) => setInputs((s) => ({ ...s, bustRelaxed: e.target.value }))}
                        type="number"
                        inputProps={{ min: 0, step: 0.1 }}
                        fullWidth
                    />
                    <TextField
                        label="Bust at 45° (cm)"
                        value={inputs.bustBend45}
                        onChange={(e) => setInputs((s) => ({ ...s, bustBend45: e.target.value }))}
                        type="number"
                        inputProps={{ min: 0, step: 0.1 }}
                        fullWidth
                    />
                    <TextField
                        label="Bust at 90° (cm)"
                        value={inputs.bustBend90}
                        onChange={(e) => setInputs((s) => ({ ...s, bustBend90: e.target.value }))}
                        type="number"
                        inputProps={{ min: 0, step: 0.1 }}
                        fullWidth
                    />

                    <Button
                        variant="contained"
                        disabled={!isComplete}
                        onClick={() => setResult(calcCup(inputs))}
                    >
                        Calculate
                    </Button>
                </Stack>

                {result ? (
                    <Box sx={{ mt: 2 }}>
                        <Alert severity={result.isValid ? 'success' : 'warning'}>
                            {result.message}
                        </Alert>
                        {result.isValid ? (
                            <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                                Underbust: {result.underBust?.toFixed(1)} cm | Cup difference:{' '}
                                {result.cupDifference?.toFixed(1)} cm | Cup: {result.cupSize}
                            </Typography>
                        ) : null}
                    </Box>
                ) : null}
            </CardContent>
        </Card>
    )
}
